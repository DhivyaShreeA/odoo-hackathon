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
        `SELECT t.*, p.name AS product_name, p.sku,
          fw.name AS from_warehouse_name, tw.name AS to_warehouse_name
         FROM transfers t
         JOIN products p ON p.id = t.product_id
         JOIN warehouses fw ON fw.id = t.from_warehouse_id
         JOIN warehouses tw ON tw.id = t.to_warehouse_id
         ORDER BY t.created_at DESC`
      )
      .all()
  );
});

const transferSchema = z
  .object({
    product_id: z.coerce.number().int().positive("Select a product"),
    from_warehouse_id: z.coerce.number().int().positive("Select the source location"),
    to_warehouse_id: z.coerce.number().int().positive("Select the destination location"),
    quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  })
  .refine((d) => d.from_warehouse_id !== d.to_warehouse_id, {
    message: "Source and destination must be different",
    path: ["to_warehouse_id"],
  });

router.post("/", validateBody(transferSchema), (req, res) => {
  const { product_id, from_warehouse_id, to_warehouse_id, quantity } = req.validated;

  const current =
    db
      .prepare("SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ?")
      .get(product_id, from_warehouse_id)?.quantity || 0;

  if (current < quantity) {
    return res.status(400).json({ error: `Insufficient stock at source: have ${current}, need ${quantity}` });
  }

  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE stock SET quantity = quantity - ? WHERE product_id = ? AND warehouse_id = ?"
    ).run(quantity, product_id, from_warehouse_id);

    db.prepare(
      `INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)
       ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = quantity + excluded.quantity`
    ).run(product_id, to_warehouse_id, quantity);

    const info = db
      .prepare(
        "INSERT INTO transfers (product_id, from_warehouse_id, to_warehouse_id, quantity, created_by) VALUES (?, ?, ?, ?, ?)"
      )
      .run(product_id, from_warehouse_id, to_warehouse_id, quantity, req.user.id);

    db.prepare(
      `INSERT INTO stock_ledger (type, product_id, warehouse_id, quantity_change, reference_type, reference_id, created_by)
       VALUES ('transfer_out', ?, ?, ?, 'transfer', ?, ?)`
    ).run(product_id, from_warehouse_id, -quantity, info.lastInsertRowid, req.user.id);

    db.prepare(
      `INSERT INTO stock_ledger (type, product_id, warehouse_id, quantity_change, reference_type, reference_id, created_by)
       VALUES ('transfer_in', ?, ?, ?, 'transfer', ?, ?)`
    ).run(product_id, to_warehouse_id, quantity, info.lastInsertRowid, req.user.id);

    return info.lastInsertRowid;
  });

  const id = tx();
  const io = req.app.get("io");
  io.emit("stock:changed", { transferId: id });

  res.status(201).json({ id, message: "Transfer completed" });
});

export default router;
