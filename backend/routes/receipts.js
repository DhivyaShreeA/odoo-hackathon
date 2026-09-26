import { Router } from "express";
import { z } from "zod";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  const { status } = req.query;
  let sql = `SELECT r.*, w.name AS warehouse_name FROM receipts r JOIN warehouses w ON w.id = r.warehouse_id WHERE 1=1`;
  const params = [];
  if (status) {
    sql += " AND r.status = ?";
    params.push(status);
  }
  sql += " ORDER BY r.created_at DESC";
  res.json(db.prepare(sql).all(...params));
});

router.get("/:id", (req, res) => {
  const receipt = db.prepare("SELECT * FROM receipts WHERE id = ?").get(req.params.id);
  if (!receipt) return res.status(404).json({ error: "Receipt not found" });
  const items = db
    .prepare(
      `SELECT ri.*, p.name AS product_name, p.sku FROM receipt_items ri JOIN products p ON p.id = ri.product_id WHERE ri.receipt_id = ?`
    )
    .all(req.params.id);
  res.json({ ...receipt, items });
});

const createSchema = z.object({
  supplier: z.string().trim().min(2, "Supplier name is required"),
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
  const { supplier, warehouse_id, items } = req.validated;
  const insertReceipt = db.prepare(
    "INSERT INTO receipts (supplier, warehouse_id, status, created_by) VALUES (?, ?, 'draft', ?)"
  );
  const insertItem = db.prepare(
    "INSERT INTO receipt_items (receipt_id, product_id, quantity) VALUES (?, ?, ?)"
  );

  const tx = db.transaction(() => {
    const info = insertReceipt.run(supplier, warehouse_id, req.user.id);
    for (const item of items) insertItem.run(info.lastInsertRowid, item.product_id, item.quantity);
    return info.lastInsertRowid;
  });

  const id = tx();
  res.status(201).json({ id, status: "draft" });
});

// Move a receipt through the draft -> waiting -> ready pipeline, or cancel it.
// "done" is never set here — that only happens via /validate, which is the
// one place stock actually moves.
const STATUS_FLOW = { draft: ["waiting", "canceled"], waiting: ["ready", "canceled"], ready: ["canceled"] };

router.patch("/:id/status", (req, res) => {
  const { status } = req.body || {};
  const receipt = db.prepare("SELECT * FROM receipts WHERE id = ?").get(req.params.id);
  if (!receipt) return res.status(404).json({ error: "Receipt not found" });
  if (receipt.status === "done" || receipt.status === "canceled") {
    return res.status(400).json({ error: `Receipt is already ${receipt.status} and can't be changed` });
  }
  const allowed = STATUS_FLOW[receipt.status] || [];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Can't move a ${receipt.status} receipt to ${status}` });
  }
  db.prepare("UPDATE receipts SET status = ? WHERE id = ?").run(status, receipt.id);
  req.app.get("io").emit("stock:changed", { receiptId: receipt.id });
  res.json({ message: "Status updated", status });
});

// Validate: applies the stock increase, writes the ledger, marks done, broadcasts live update
router.post("/:id/validate", (req, res) => {
  const receipt = db.prepare("SELECT * FROM receipts WHERE id = ?").get(req.params.id);
  if (!receipt) return res.status(404).json({ error: "Receipt not found" });
  if (receipt.status === "done") return res.status(400).json({ error: "Receipt already validated" });
  if (receipt.status === "canceled") return res.status(400).json({ error: "Can't validate a canceled receipt" });

  const items = db.prepare("SELECT * FROM receipt_items WHERE receipt_id = ?").all(receipt.id);

  const upsertStock = db.prepare(
    `INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)
     ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = quantity + excluded.quantity`
  );
  const insertLedger = db.prepare(
    `INSERT INTO stock_ledger (type, product_id, warehouse_id, quantity_change, reference_type, reference_id, created_by)
     VALUES ('receipt', ?, ?, ?, 'receipt', ?, ?)`
  );

  const tx = db.transaction(() => {
    for (const item of items) {
      upsertStock.run(item.product_id, receipt.warehouse_id, item.quantity);
      insertLedger.run(item.product_id, receipt.warehouse_id, item.quantity, receipt.id, req.user.id);
    }
    db.prepare("UPDATE receipts SET status = 'done', validated_at = strftime('%s','now') WHERE id = ?").run(
      receipt.id
    );
  });
  tx();

  const io = req.app.get("io");
  io.emit("stock:changed", { receiptId: receipt.id, warehouseId: receipt.warehouse_id });

  res.json({ message: "Receipt validated, stock updated" });
});

export default router;
