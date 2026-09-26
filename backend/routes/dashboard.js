import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/kpis", (req, res) => {
  const totalProducts = db.prepare("SELECT COUNT(*) c FROM products").get().c;

  // Low stock and out of stock are counted separately: "low" means some stock
  // remains but at or below the reorder level, "out" means literally zero.
  const lowStock = db
    .prepare(
      `SELECT COUNT(*) c FROM (
        SELECT p.id, p.reorder_level, COALESCE(SUM(s.quantity),0) AS total
        FROM products p LEFT JOIN stock s ON s.product_id = p.id
        GROUP BY p.id HAVING total > 0 AND total <= p.reorder_level
      )`
    )
    .get().c;

  const outOfStock = db
    .prepare(
      `SELECT COUNT(*) c FROM (
        SELECT p.id, COALESCE(SUM(s.quantity),0) AS total
        FROM products p LEFT JOIN stock s ON s.product_id = p.id
        GROUP BY p.id HAVING total <= 0
      )`
    )
    .get().c;

  const pendingReceipts = db
    .prepare("SELECT COUNT(*) c FROM receipts WHERE status != 'done' AND status != 'canceled'")
    .get().c;

  const pendingDeliveries = db
    .prepare("SELECT COUNT(*) c FROM deliveries WHERE status != 'done' AND status != 'canceled'")
    .get().c;

  const transfersToday = db
    .prepare("SELECT COUNT(*) c FROM transfers WHERE created_at >= strftime('%s','now','start of day')")
    .get().c;

  res.json({
    totalProducts,
    lowStock,
    outOfStock,
    pendingReceipts,
    pendingDeliveries,
    transfersToday,
  });
});

// Move history / stock ledger, with basic filters — this is the "everything is logged" proof
router.get("/ledger", (req, res) => {
  const { type, warehouse_id, product_id, category_id, limit = 50 } = req.query;
  let sql = `
    SELECT l.*, p.name AS product_name, p.sku, p.category_id, w.name AS warehouse_name
    FROM stock_ledger l
    JOIN products p ON p.id = l.product_id
    JOIN warehouses w ON w.id = l.warehouse_id
    WHERE 1=1
  `;
  const params = [];
  if (type) {
    sql += " AND l.type = ?";
    params.push(type);
  }
  if (warehouse_id) {
    sql += " AND l.warehouse_id = ?";
    params.push(warehouse_id);
  }
  if (product_id) {
    sql += " AND l.product_id = ?";
    params.push(product_id);
  }
  if (category_id) {
    sql += " AND p.category_id = ?";
    params.push(category_id);
  }
  sql += " ORDER BY l.created_at DESC LIMIT ?";
  params.push(Number(limit));
  res.json(db.prepare(sql).all(...params));
});

// Unified "Operations" list: receipts, deliveries, internal transfers, and
// adjustments merged into one feed, each carrying a status (transfers and
// adjustments execute instantly so they're always "done"). This is what
// powers the dashboard's document-type + status + warehouse + category filters.
router.get("/documents", (req, res) => {
  const { type, status, warehouse_id, category_id, limit = 50 } = req.query;
  const docs = [];

  if (!type || type === "receipt") {
    let sql = `SELECT r.id, 'receipt' AS type, r.status, r.supplier AS reference,
                 r.warehouse_id, w.name AS warehouse_name, r.created_at
               FROM receipts r JOIN warehouses w ON w.id = r.warehouse_id WHERE 1=1`;
    const params = [];
    if (status) {
      sql += " AND r.status = ?";
      params.push(status);
    }
    if (warehouse_id) {
      sql += " AND r.warehouse_id = ?";
      params.push(warehouse_id);
    }
    if (category_id) {
      sql += ` AND r.id IN (SELECT ri.receipt_id FROM receipt_items ri JOIN products p ON p.id = ri.product_id WHERE p.category_id = ?)`;
      params.push(category_id);
    }
    docs.push(...db.prepare(sql).all(...params));
  }

  if (!type || type === "delivery") {
    let sql = `SELECT d.id, 'delivery' AS type, d.status, d.customer AS reference,
                 d.warehouse_id, w.name AS warehouse_name, d.created_at
               FROM deliveries d JOIN warehouses w ON w.id = d.warehouse_id WHERE 1=1`;
    const params = [];
    if (status) {
      sql += " AND d.status = ?";
      params.push(status);
    }
    if (warehouse_id) {
      sql += " AND d.warehouse_id = ?";
      params.push(warehouse_id);
    }
    if (category_id) {
      sql += ` AND d.id IN (SELECT di.delivery_id FROM delivery_items di JOIN products p ON p.id = di.product_id WHERE p.category_id = ?)`;
      params.push(category_id);
    }
    docs.push(...db.prepare(sql).all(...params));
  }

  // Transfers and adjustments apply immediately — there's no draft/waiting
  // stage — so they only ever match a status filter of "done" or no filter.
  if ((!type || type === "internal") && (!status || status === "done")) {
    let sql = `SELECT t.id, 'internal' AS type, 'done' AS status,
                 (p.name || ': ' || fw.name || ' -> ' || tw.name) AS reference,
                 t.to_warehouse_id AS warehouse_id, tw.name AS warehouse_name, t.created_at
               FROM transfers t
               JOIN products p ON p.id = t.product_id
               JOIN warehouses fw ON fw.id = t.from_warehouse_id
               JOIN warehouses tw ON tw.id = t.to_warehouse_id
               WHERE 1=1`;
    const params = [];
    if (warehouse_id) {
      sql += " AND (t.from_warehouse_id = ? OR t.to_warehouse_id = ?)";
      params.push(warehouse_id, warehouse_id);
    }
    if (category_id) {
      sql += " AND p.category_id = ?";
      params.push(category_id);
    }
    docs.push(...db.prepare(sql).all(...params));
  }

  if ((!type || type === "adjustment") && (!status || status === "done")) {
    let sql = `SELECT a.id, 'adjustment' AS type, 'done' AS status, p.name AS reference,
                 a.warehouse_id, w.name AS warehouse_name, a.created_at
               FROM adjustments a
               JOIN products p ON p.id = a.product_id
               JOIN warehouses w ON w.id = a.warehouse_id
               WHERE 1=1`;
    const params = [];
    if (warehouse_id) {
      sql += " AND a.warehouse_id = ?";
      params.push(warehouse_id);
    }
    if (category_id) {
      sql += " AND p.category_id = ?";
      params.push(category_id);
    }
    docs.push(...db.prepare(sql).all(...params));
  }

  docs.sort((a, b) => b.created_at - a.created_at);
  res.json(docs.slice(0, Number(limit)));
});

export default router;
