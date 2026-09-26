import { Router } from "express";
import { z } from "zod";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();
router.use(requireAuth);

// list products with total stock across all warehouses + low-stock flag
router.get("/", (req, res) => {
  const { search, category_id } = req.query;
  let sql = `
    SELECT p.*, c.name AS category_name,
      COALESCE(SUM(s.quantity), 0) AS total_stock
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN stock s ON s.product_id = p.id
    WHERE 1=1
  `;
  const params = [];
  if (search) {
    sql += " AND (p.name LIKE ? OR p.sku LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category_id) {
    sql += " AND p.category_id = ?";
    params.push(category_id);
  }
  sql += " GROUP BY p.id ORDER BY p.created_at DESC";
  res.json(db.prepare(sql).all(...params));
});

router.get("/:id/stock", (req, res) => {
  const rows = db
    .prepare(
      `SELECT s.warehouse_id, w.name AS warehouse_name, s.quantity
       FROM stock s JOIN warehouses w ON w.id = s.warehouse_id
       WHERE s.product_id = ?`
    )
    .all(req.params.id);
  res.json(rows);
});

const productSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  sku: z
    .string()
    .trim()
    .min(2, "SKU must be at least 2 characters")
    .regex(/^[A-Za-z0-9-_]+$/, "SKU may only contain letters, numbers, - and _"),
  category_id: z.coerce.number().int().positive().optional().nullable(),
  unit: z.string().trim().min(1).default("pcs"),
  reorder_level: z.coerce.number().min(0).default(0),
  initial_stock: z.coerce.number().min(0).default(0),
  warehouse_id: z.coerce.number().int().positive().optional(),
});

router.post("/", validateBody(productSchema), (req, res) => {
  const { name, sku, category_id, unit, reorder_level, initial_stock, warehouse_id } = req.validated;

  const existing = db.prepare("SELECT id FROM products WHERE sku = ?").get(sku);
  if (existing) return res.status(409).json({ error: "SKU already exists" });

  const info = db
    .prepare(
      "INSERT INTO products (name, sku, category_id, unit, reorder_level) VALUES (?, ?, ?, ?, ?)"
    )
    .run(name, sku, category_id || null, unit, reorder_level);

  if (initial_stock > 0) {
    const wh = warehouse_id || db.prepare("SELECT id FROM warehouses ORDER BY id LIMIT 1").get()?.id;
    if (wh) {
      db.prepare(
        "INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?) ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = quantity + excluded.quantity"
      ).run(info.lastInsertRowid, wh, initial_stock);
      db.prepare(
        `INSERT INTO stock_ledger (type, product_id, warehouse_id, quantity_change, reference_type, note)
         VALUES ('adjustment', ?, ?, ?, 'initial_stock', 'Initial stock on product creation')`
      ).run(info.lastInsertRowid, wh, initial_stock);
    }
  }

  const io = req.app.get("io");
  io.emit("stock:changed", { productId: info.lastInsertRowid });

  res.status(201).json({ id: info.lastInsertRowid, name, sku });
});

const updateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  sku: z
    .string()
    .trim()
    .min(2, "SKU must be at least 2 characters")
    .regex(/^[A-Za-z0-9-_]+$/, "SKU may only contain letters, numbers, - and _"),
  category_id: z.coerce.number().int().positive().optional().nullable(),
  unit: z.string().trim().min(1).default("pcs"),
  reorder_level: z.coerce.number().min(0).default(0),
});

// Edit an existing product's details (name, SKU, category, unit, reorder level).
// Stock quantities are never touched here — those only change via receipts,
// deliveries, transfers, and adjustments, so the ledger stays the single
// source of truth for every quantity change.
router.put("/:id", validateBody(updateSchema), (req, res) => {
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const { name, sku, category_id, unit, reorder_level } = req.validated;

  const clash = db.prepare("SELECT id FROM products WHERE sku = ? AND id != ?").get(sku, req.params.id);
  if (clash) return res.status(409).json({ error: "SKU already exists" });

  db.prepare(
    "UPDATE products SET name = ?, sku = ?, category_id = ?, unit = ?, reorder_level = ? WHERE id = ?"
  ).run(name, sku, category_id || null, unit, reorder_level, req.params.id);

  const io = req.app.get("io");
  io.emit("stock:changed", { productId: req.params.id });

  res.json({ message: "Product updated" });
});

router.get("/low-stock", (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.sku, p.reorder_level, COALESCE(SUM(s.quantity),0) AS total_stock
       FROM products p LEFT JOIN stock s ON s.product_id = p.id
       GROUP BY p.id
       HAVING total_stock <= p.reorder_level`
    )
    .all()
    // tag each row so consumers can separate "out" from merely "low" without
    // re-deriving the threshold logic themselves
    .map((p) => ({ ...p, status: p.total_stock <= 0 ? "out_of_stock" : "low_stock" }));
  res.json(rows);
});

export default router;
