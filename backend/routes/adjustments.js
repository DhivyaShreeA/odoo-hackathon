import { Router } from "express";
import { z } from "zod";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT a.*, p.name AS product_name, p.sku, w.name AS warehouse_name
         FROM adjustments a
         JOIN products p ON p.id = a.product_id
         JOIN warehouses w ON w.id = a.warehouse_id
         ORDER BY a.created_at DESC`
      )
      .all()
  );
});

const adjustSchema = z.object({
  product_id: z.coerce.number().int().positive("Select a product"),
  warehouse_id: z.coerce.number().int().positive("Select a location"),
  counted_quantity: z.coerce.number().min(0, "Counted quantity cannot be negative"),
  reason: z.string().trim().max(280).optional().default(""),
});

router.post("/", validateBody(adjustSchema), (req, res) => {
  const { product_id, warehouse_id, counted_quantity, reason } = req.validated;

  const current =
    db
      .prepare("SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ?")
      .get(product_id, warehouse_id)?.quantity || 0;

  const difference = counted_quantity - current;

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)
       ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = excluded.quantity`
    ).run(product_id, warehouse_id, counted_quantity);

    const info = db
      .prepare(
        "INSERT INTO adjustments (product_id, warehouse_id, counted_quantity, difference, reason, created_by) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(product_id, warehouse_id, counted_quantity, difference, reason, req.user.id);

    db.prepare(
      `INSERT INTO stock_ledger (type, product_id, warehouse_id, quantity_change, reference_type, reference_id, note, created_by)
       VALUES ('adjustment', ?, ?, ?, 'adjustment', ?, ?, ?)`
    ).run(product_id, warehouse_id, difference, info.lastInsertRowid, reason, req.user.id);

    return info.lastInsertRowid;
  });

  const id = tx();
  const io = req.app.get("io");
  io.emit("stock:changed", { adjustmentId: id });

  res.status(201).json({ id, difference, message: "Stock adjusted" });
});

export default router;
