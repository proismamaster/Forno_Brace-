const Database = require('better-sqlite3');
const path = require('path');
const config = require('./config');

const db = new Database(path.join(__dirname, config.DB_FILE));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'user',
    address       TEXT,
    phone         TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    price       INTEGER NOT NULL,
    category    TEXT    NOT NULL DEFAULT 'pani',
    emoji       TEXT    NOT NULL DEFAULT '🥖',
    image       TEXT    NOT NULL DEFAULT '',
    images      TEXT    NOT NULL DEFAULT '[]',
    available   INTEGER NOT NULL DEFAULT 1,
    quantity    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL,
    status           TEXT    NOT NULL DEFAULT 'ricevuto',
    order_type       TEXT    NOT NULL DEFAULT 'consegna',
    subtotal         INTEGER NOT NULL,
    delivery_fee     INTEGER NOT NULL DEFAULT 0,
    total            INTEGER NOT NULL,
    payment_method   TEXT    NOT NULL,
    payment_status   TEXT    NOT NULL DEFAULT 'in_attesa',
    payment_ref      TEXT,
    delivery_name    TEXT    NOT NULL,
    delivery_address TEXT,
    delivery_phone   TEXT,
    scheduled_time   TEXT,
    party_size       INTEGER,
    notes            TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id     INTEGER NOT NULL,
    product_id   INTEGER,
    product_name TEXT    NOT NULL,
    unit_price   INTEGER NOT NULL,
    quantity     INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE INDEX IF NOT EXISTS idx_orders_user   ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_items_order   ON order_items(order_id);
`);

try {
  const cols = db.prepare("PRAGMA table_info(products)").all().map(c => c.name);
  if (!cols.includes('images')) {
    db.exec("ALTER TABLE products ADD COLUMN images TEXT NOT NULL DEFAULT '[]'");
    console.log('  Migrazione: colonna images aggiunta alla tabella products.');
  }
  if (!cols.includes('quantity')) {
    db.exec("ALTER TABLE products ADD COLUMN quantity INTEGER NOT NULL DEFAULT 0");
    console.log('  Migrazione: colonna quantity aggiunta alla tabella products.');
  }
} catch (_) {}

module.exports = db;
