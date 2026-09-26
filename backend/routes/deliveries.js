import { Router } from "express";
import { z } from "zod";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  const { status } = req.query;
  let sql = `SELECT d.*, w.name AS warehouse_name FROM deliveries d JOIN warehouses w ON w.id = d.warehouse_id WHERE 1=1`;
  const params = [];
  if (status) {
    sql += " AND d.status = ?";
    params.push(status);
  }
  sql += " ORDER BY d.created_at DESC";
  res.json(db.prepare(sql).all(...params));
});

router.get("/:id", (req, res) => {
  const delivery = db.prepare("SELECT * FROM deliveries WHERE id = ?").get(req.params.id);
  if (!delivery) return res.status(404).json({ error: "Delivery not found" });
  const items = db
    .prepare(
      `SELECT di.*, p.name AS product_name, p.sku FROM delivery_items di JOIN products p ON p.id = di.product_id WHERE di.delivery_id = ?`
    )
    .all(req.params.id);
  res.json({ ...delivery, items });
});

const createSchema = z.object({
  customer: z.string().trim().min(2, "Customer name is required"),
  warehouse_id: z.coerce.number().int().positive("Select a warehouse"),
  items: z
    .array(
      z.object({
        product_id: z.coerce.number().int().positive("Select a product"),
        quantity: z.coerce.number().positive("Quantity must be greater than 0"),
      })
    )
    .min(1, "Add at least one product line"),
});

router.post("/", validateBody(createSchema), (req, res) => {
  const { customer, warehouse_id, items } = req.validated;
  const insertDelivery = db.prepare(
    "INSERT INTO deliveries (customer, warehouse_id, status, created_by) VALUES (?, ?, 'draft', ?)"
  );
  const insertItem = db.prepare(
    "INSERT INTO delivery_items (delivery_id, product_id, quantity) VALUES (?, ?, ?)"
  );

  const tx = db.transaction(() => {
    const info = insertDelivery.run(customer, warehouse_id, req.user.id);
    for (const item of items) insertItem.run(info.lastInsertRowid, item.product_id, item.quantity);
    return info.lastInsertRowid;
  });

  res.status(201).json({ id: tx(), status: "draft" });
});

// Move a delivery through the pick -> pack pipeline (draft -> waiting="picking" ->
// ready="packed"), or cancel it. Stock only ever moves in /validate.
const STATUS_FLOW = { draft: ["waiting", "canceled"], waiting: ["ready", "canceled"], ready: ["canceled"] };

router.patch("/:id/status", (req, res) => {
  const { status } = req.body || {};
  const delivery = db.prepare("SELECT * FROM deliveries WHERE id = ?").get(req.params.id);
  if (!delivery) return res.status(404).json({ error: "Delivery not found" });
  if (delivery.status === "done" || delivery.status === "canceled") {
    return res.status(400).json({ error: `Delivery is already ${delivery.status} and can't be changed` });
  }
  const allowed = STATUS_FLOW[delivery.status] || [];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Can't move a ${delivery.status} delivery to ${status}` });
  }
  db.prepare("UPDATE deliveries SET status = ? WHERE id = ?").run(status, delivery.id);
  req.app.get("io").emit("stock:changed", { deliveryId: delivery.id });
  res.json({ message: "Status updated", status });
});

// Validate: checks stock is sufficient BEFORE decreasing anything (all-or-nothing)
router.post("/:id/validate", (req, res) => {
  const delivery = db.prepare("SELECT * FROM deliveries WHERE id = ?").get(req.params.id);
  if (!delivery) return res.status(404).json({ error: "Delivery not found" });
  if (delivery.status === "done") return res.status(400).json({ error: "Delivery already validated" });
  if (delivery.status === "canceled") return res.status(400).json({ error: "Can't validate a canceled delivery" });

  const items = db.prepare("SELECT * FROM delivery_items WHERE delivery_id = ?").all(delivery.id);
  const getStock = db.prepare("SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ?");

  for (const item of items) {
    const current = getStock.get(item.product_id, delivery.warehouse_id)?.quantity || 0;
    if (current < item.quantity) {
      return res.status(400).json({
        error: `Insufficient stock for product ${item.product_id}: have ${current}, need ${item.quantity}`,
      });
    }
  }

  const updateStock = db.prepare(
    "UPDATE stock SET quantity = quantity - ? WHERE product_id = ? AND warehouse_id = ?"
  );
  const insertLedger = db.prepare(
    `INSERT INTO stock_ledger (type, product_id, warehouse_id, quantity_change, reference_type, reference_id, created_by)
     VALUES ('delivery', ?, ?, ?, 'delivery', ?, ?)`
  );

  const tx = db.transaction(() => {
    for (const item of items) {
      updateStock.run(item.quantity, item.product_id, delivery.warehouse_id);
      insertLedger.run(item.product_id, delivery.warehouse_id, -item.quantity, delivery.id, req.user.id);
    }
    db.prepare("UPDATE deliveries SET status = 'done', validated_at = strftime('%s','now') WHERE id = ?").run(
      delivery.id
    );
  });
  tx();

  const io = req.app.get("io");
  io.emit("stock:changed", { deliveryId: delivery.id, warehouseId: delivery.warehouse_id });

  res.json({ message: "Delivery validated, stock updated" });
});

export default router;
