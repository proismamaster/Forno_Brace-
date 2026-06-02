// Server principale: API REST + servizio dei file statici del frontend.
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');

const config = require('./config');
const db = require('./db');
const seed = require('./seed');
const { signToken, requireAuth, requireAdmin, getUserFromRequest } = require('./auth');
const { simulateCardPayment } = require('./payments');

// Al primo avvio popola il database (admin, utente demo, menu) se è vuoto.
console.log('📦 Inizializzazione database...');
try {
  seed.run();
  console.log('✅ Database pronto.');
} catch (err) {
  console.error('❌ Errore inizializzazione database:', err);
}

const app = express();
app.use(express.json());

// Middleware per i log delle richieste (utile per il debug su Render)
app.use((req, res, next) => {
  if (!req.url.startsWith('/images')) {
    console.log(`[${new Date().toISOString().split('T')[1].split('.')[0]}] ${req.method} ${req.url}`);
  }
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Debug & Health Check
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/debug', (req, res) => {
  const fs = require('fs');
  const dbPath = path.join(__dirname, config.DB_FILE);
  const pizzasCount = db.prepare('SELECT COUNT(*) AS c FROM pizzas').get().c;
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development',
    database: {
      path: dbPath,
      exists: fs.existsSync(dbPath),
      pizzas: pizzasCount
    },
    staticFiles: {
      public: fs.existsSync(path.join(__dirname, 'public')),
      css: fs.existsSync(path.join(__dirname, 'public', 'css', 'style.css'))
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────
const STATUSES = ['ricevuto', 'in_preparazione', 'in_consegna', 'consegnato', 'annullato'];

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, address: u.address, phone: u.phone };
}

function computeDeliveryFee(subtotal) {
  if (config.FREE_DELIVERY_OVER > 0 && subtotal >= config.FREE_DELIVERY_OVER) return 0;
  return config.DELIVERY_FEE;
}

function getOrderWithItems(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
  return order;
}

function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// Configurazione pubblica (consegna, ecc.)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({
    deliveryFee: config.DELIVERY_FEE,
    freeDeliveryOver: config.FREE_DELIVERY_OVER,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Autenticazione
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, address, phone } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Inserisci il tuo nome.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Email non valida.' });
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'La password deve avere almeno 6 caratteri.' });

  const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.toLowerCase());
  if (exists) return res.status(409).json({ error: 'Email già registrata.' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, address, phone)
     VALUES (?, ?, ?, 'user', ?, ?)`
  ).run(name.trim(), email.toLowerCase(), hash, address || null, phone || null);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!isEmail(email) || !password) return res.status(400).json({ error: 'Email o password mancanti.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Email o password errati.' });

  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utente non trovato.' });
  res.json({ user: publicUser(user) });
});

app.put('/api/auth/me', requireAuth, (req, res) => {
  const { name, address, phone } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utente non trovato.' });
  db.prepare('UPDATE users SET name = ?, address = ?, phone = ? WHERE id = ?').run(
    name?.trim() || user.name, address ?? user.address, phone ?? user.phone, user.id
  );
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ user: publicUser(updated) });
});

// ─────────────────────────────────────────────────────────────────────────────
// Menu pizze
// ─────────────────────────────────────────────────────────────────────────────
// Pubblico: elenco pizze disponibili. Admin (con token) può vedere tutto con ?all=1
app.get('/api/pizzas', (req, res) => {
  const u = getUserFromRequest(req);
  const showAll = req.query.all === '1' && u && u.role === 'admin';
  const rows = showAll
    ? db.prepare('SELECT * FROM pizzas ORDER BY category, name').all()
    : db.prepare('SELECT * FROM pizzas WHERE available = 1 ORDER BY category, name').all();
  res.json({ pizzas: rows });
});

app.post('/api/pizzas', requireAdmin, (req, res) => {
  const { name, description, price, category, emoji, image, available } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nome obbligatorio.' });
  const cents = Math.round(Number(price));
  if (!Number.isFinite(cents) || cents < 0) return res.status(400).json({ error: 'Prezzo non valido.' });
  const info = db.prepare(
    `INSERT INTO pizzas (name, description, price, category, emoji, image, available)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(name.trim(), description || '', cents, category || 'classiche', emoji || '🍕',
        image || '', available === false ? 0 : 1);
  res.status(201).json({ pizza: db.prepare('SELECT * FROM pizzas WHERE id = ?').get(info.lastInsertRowid) });
});

app.put('/api/pizzas/:id', requireAdmin, (req, res) => {
  const p = db.prepare('SELECT * FROM pizzas WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Pizza non trovata.' });
  const { name, description, price, category, emoji, image, available } = req.body || {};
  const cents = price === undefined ? p.price : Math.round(Number(price));
  if (!Number.isFinite(cents) || cents < 0) return res.status(400).json({ error: 'Prezzo non valido.' });
  db.prepare(
    `UPDATE pizzas SET name = ?, description = ?, price = ?, category = ?, emoji = ?, image = ?, available = ?
     WHERE id = ?`
  ).run(
    name?.trim() || p.name, description ?? p.description, cents, category || p.category,
    emoji || p.emoji, image === undefined ? p.image : image, available === undefined ? p.available : (available ? 1 : 0), p.id
  );
  res.json({ pizza: db.prepare('SELECT * FROM pizzas WHERE id = ?').get(p.id) });
});

app.delete('/api/pizzas/:id', requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM pizzas WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Pizza non trovata.' });
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ordini (lato utente)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/orders', requireAuth, (req, res) => {
  const { items, payment_method, card, delivery, notes } = req.body || {};
  const order_type = (req.body && req.body.order_type) || 'consegna';

  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Il carrello è vuoto.' });
  if (!['contanti', 'carta'].includes(payment_method))
    return res.status(400).json({ error: 'Metodo di pagamento non valido.' });
  if (!['consegna', 'asporto', 'tavolo'].includes(order_type))
    return res.status(400).json({ error: 'Tipo di ordine non valido.' });
  if (!delivery || !delivery.name || !delivery.name.trim())
    return res.status(400).json({ error: 'Inserisci il tuo nome.' });
  if (order_type === 'consegna' && (!delivery.address || !delivery.phone))
    return res.status(400).json({ error: 'Per la consegna servono indirizzo e telefono.' });
  if (order_type === 'asporto' && !delivery.phone)
    return res.status(400).json({ error: 'Per l\'asporto serve un numero di telefono.' });
  const partySize = parseInt(delivery && delivery.party_size, 10);
  if (order_type === 'tavolo' && (!Number.isFinite(partySize) || partySize < 1))
    return res.status(400).json({ error: 'Indica per quante persone è il tavolo.' });

  // Ricalcola sempre i prezzi dal database: non ci si fida del client.
  const getPizza = db.prepare('SELECT * FROM pizzas WHERE id = ?');
  const lines = [];
  let subtotal = 0;
  for (const it of items) {
    const qty = Math.max(1, Math.min(20, parseInt(it.quantity, 10) || 0));
    const pizza = getPizza.get(it.pizza_id);
    if (!pizza) return res.status(400).json({ error: `Pizza non disponibile (id ${it.pizza_id}).` });
    if (!pizza.available) return res.status(400).json({ error: `"${pizza.name}" non è più disponibile.` });
    subtotal += pizza.price * qty;
    lines.push({ pizza_id: pizza.id, pizza_name: pizza.name, unit_price: pizza.price, quantity: qty });
  }

  // Il costo di consegna si applica solo agli ordini a domicilio.
  const delivery_fee = order_type === 'consegna' ? computeDeliveryFee(subtotal) : 0;
  const total = subtotal + delivery_fee;

  // Gestione pagamento.
  let payment_status = 'in_attesa';
  let payment_ref = null;
  if (payment_method === 'carta') {
    const result = simulateCardPayment(card || {}, total);
    if (!result.ok) {
      // Pagamento rifiutato: NON creiamo l'ordine, l'utente può riprovare.
      return res.status(402).json({ error: result.message, code: result.code });
    }
    payment_status = 'pagato';
    payment_ref = result.reference;
  }

  // Inserimento atomico di ordine + righe.
  const createOrder = db.transaction(() => {
    const info = db.prepare(
      `INSERT INTO orders
        (user_id, status, order_type, subtotal, delivery_fee, total, payment_method, payment_status,
         payment_ref, delivery_name, delivery_address, delivery_phone, scheduled_time, party_size, notes)
       VALUES (?, 'ricevuto', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.user.id, order_type, subtotal, delivery_fee, total, payment_method, payment_status,
      payment_ref, delivery.name.trim(),
      order_type === 'consegna' ? delivery.address.trim() : null,
      (order_type === 'consegna' || order_type === 'asporto') && delivery.phone ? delivery.phone.trim() : null,
      (delivery.scheduled_time || '').trim() || null,
      order_type === 'tavolo' ? partySize : null,
      (notes || '').trim() || null
    );
    const orderId = info.lastInsertRowid;
    const insItem = db.prepare(
      `INSERT INTO order_items (order_id, pizza_id, pizza_name, unit_price, quantity)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const l of lines) insItem.run(orderId, l.pizza_id, l.pizza_name, l.unit_price, l.quantity);
    return orderId;
  });

  const orderId = createOrder();
  res.status(201).json({ order: getOrderWithItems(orderId) });
});

app.get('/api/orders/mine', requireAuth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  for (const o of orders) o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  res.json({ orders });
});

app.get('/api/orders/:id', requireAuth, (req, res) => {
  const order = getOrderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: 'Ordine non trovato.' });
  if (order.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Non puoi vedere questo ordine.' });
  res.json({ order });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ordini (lato admin)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/orders', requireAdmin, (req, res) => {
  const { status } = req.query;
  let rows;
  if (status && STATUSES.includes(status)) {
    rows = db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC').all(status);
  } else {
    rows = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  }
  const userStmt = db.prepare('SELECT name, email FROM users WHERE id = ?');
  for (const o of rows) {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
    o.customer = userStmt.get(o.user_id) || null;
  }
  res.json({ orders: rows });
});

app.patch('/api/orders/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Stato non valido.' });
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Ordine non trovato.' });

  // Se consegnato e pagamento in contanti -> consideralo incassato.
  let payment_status = order.payment_status;
  if (status === 'consegnato' && order.payment_method === 'contanti' && payment_status === 'in_attesa') {
    payment_status = 'pagato';
  }
  db.prepare(`UPDATE orders SET status = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(status, payment_status, order.id);
  res.json({ order: getOrderWithItems(order.id) });
});

app.patch('/api/orders/:id/payment', requireAdmin, (req, res) => {
  const { payment_status } = req.body || {};
  if (!['in_attesa', 'pagato', 'fallito'].includes(payment_status))
    return res.status(400).json({ error: 'Stato pagamento non valido.' });
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Ordine non trovato.' });
  db.prepare(`UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(payment_status, order.id);
  res.json({ order: getOrderWithItems(order.id) });
});

// Statistiche per la dashboard admin.
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const today = db.prepare(
    `SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS revenue
     FROM orders WHERE date(created_at) = date('now') AND status != 'annullato'`
  ).get();
  const pending = db.prepare(
    `SELECT COUNT(*) AS c FROM orders WHERE status IN ('ricevuto','in_preparazione','in_consegna')`
  ).get().c;
  const totalOrders = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
  const revenueAll = db.prepare(
    `SELECT COALESCE(SUM(total),0) AS r FROM orders WHERE payment_status = 'pagato'`
  ).get().r;
  res.json({
    ordersToday: today.c,
    revenueToday: today.revenue,
    pending,
    totalOrders,
    revenueAll,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// File statici + pagine
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Gestione errori generica.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Errore interno del server.' });
});

app.listen(config.PORT, () => {
  console.log('\n🌋  Pizzeria Vulcano · Lodi Vecchio');
  console.log(`    Sito utente:  http://localhost:${config.PORT}`);
  console.log(`    Pannello admin: http://localhost:${config.PORT}/admin`);
  console.log(`    Admin: ${config.ADMIN_EMAIL} / ${config.ADMIN_PASSWORD}`);
  console.log(`    Demo:  ${config.DEMO_EMAIL} / ${config.DEMO_PASSWORD}\n`);
});
