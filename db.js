// Connessione al database SQLite e creazione dello schema.
const Database = require('better-sqlite3');
const path = require('path');
const config = require('./config');

const db = new Database(path.join(__dirname, config.DB_FILE));

// Migliora affidabilità e concorrenza in lettura/scrittura.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema del database.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
    address       TEXT,
    phone         TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pizzas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    price       INTEGER NOT NULL,                    -- prezzo in centesimi
    category    TEXT    NOT NULL DEFAULT 'classiche',
    emoji       TEXT    NOT NULL DEFAULT '🍕',
    available   INTEGER NOT NULL DEFAULT 1,          -- 0/1
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL,
    status           TEXT    NOT NULL DEFAULT 'ricevuto',   -- ricevuto|in_preparazione|in_consegna|consegnato|annullato
    subtotal         INTEGER NOT NULL,                       -- centesimi
    delivery_fee     INTEGER NOT NULL DEFAULT 0,             -- centesimi
    total            INTEGER NOT NULL,                       -- centesimi
    payment_method   TEXT    NOT NULL,                       -- 'contanti' | 'carta'
    payment_status   TEXT    NOT NULL DEFAULT 'in_attesa',   -- in_attesa | pagato | fallito
    payment_ref      TEXT,                                   -- riferimento pagamento simulato (es. ch_xxx)
    delivery_name    TEXT    NOT NULL,
    delivery_address TEXT    NOT NULL,
    delivery_phone   TEXT    NOT NULL,
    notes            TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL,
    pizza_id   INTEGER,
    pizza_name TEXT    NOT NULL,        -- "fotografia" del nome al momento dell'ordine
    unit_price INTEGER NOT NULL,        -- "fotografia" del prezzo (centesimi)
    quantity   INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (pizza_id) REFERENCES pizzas(id)
  );

  CREATE INDEX IF NOT EXISTS idx_orders_user   ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_items_order   ON order_items(order_id);
`);

module.exports = db;
