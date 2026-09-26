import Database from "better-sqlite3";

const db = new Database("stocksense.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ---- Schema ----
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  otp TEXT,
  otp_expires_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS warehouses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  unit TEXT NOT NULL DEFAULT 'pcs',
  reorder_level INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

-- current stock per product per warehouse
CREATE TABLE IF NOT EXISTS stock (
  product_id INTEGER NOT NULL REFERENCES products(id),
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  quantity REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, warehouse_id)
);

-- append-only ledger: every stock movement of any kind lands here
CREATE TABLE IF NOT EXISTS stock_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL, -- 'receipt' | 'delivery' | 'transfer_out' | 'transfer_in' | 'adjustment'
  product_id INTEGER NOT NULL REFERENCES products(id),
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  quantity_change REAL NOT NULL, -- signed
  reference_type TEXT, -- 'receipt' | 'delivery' | 'transfer' | 'adjustment'
  reference_id INTEGER,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier TEXT NOT NULL,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  status TEXT NOT NULL DEFAULT 'draft', -- draft, waiting, ready, done, canceled
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER DEFAULT (strftime('%s','now')),
  validated_at INTEGER
);

CREATE TABLE IF NOT EXISTS receipt_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_id INTEGER NOT NULL REFERENCES receipts(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer TEXT NOT NULL,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  status TEXT NOT NULL DEFAULT 'draft',
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER DEFAULT (strftime('%s','now')),
  validated_at INTEGER
);

CREATE TABLE IF NOT EXISTS delivery_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_id INTEGER NOT NULL REFERENCES deliveries(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  from_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  to_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  quantity REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'done',
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  counted_quantity REAL NOT NULL,
  difference REAL NOT NULL,
  reason TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER DEFAULT (strftime('%s','now'))
);
`);

// seed one default warehouse + category so the app isn't empty on first run
const wh = db.prepare("SELECT COUNT(*) c FROM warehouses").get();
if (wh.c === 0) {
  db.prepare("INSERT INTO warehouses (name, location) VALUES (?, ?)").run("Main Warehouse", "Default");
}
const cat = db.prepare("SELECT COUNT(*) c FROM categories").get();
if (cat.c === 0) {
  db.prepare("INSERT INTO categories (name) VALUES (?)").run("General");
}

export default db;
