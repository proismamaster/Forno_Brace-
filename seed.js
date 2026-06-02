// Popola il database con il menu di Bella Istanbul Turkish Kebap, un account admin e un utente demo.
const bcrypt = require('bcryptjs');
const db = require('./db');
const config = require('./config');

const PIZZE = [
  // ── KEBAB & TURKISH SPECIALITIES ──────────────────────────────────────────
  { name: 'Panino Kebab', price: 600, category: 'kebab', emoji: '🥙', image: 'kebab-panino.jpg',
    description: 'Carne artigianale, insalata fresca, pomodoro, cipolla e salse yogurt/piccante.' },
  { name: 'Piadina Kebab', price: 600, category: 'kebab', emoji: '🌯', image: 'durum.jpg',
    description: 'Piadina arrotolata con carne kebab, verdure croccanti e salse della casa.' },
  { name: 'Piatto Kebab (Döner)', price: 900, category: 'kebab', emoji: '🍽️', image: 'kebab-piatto.jpg',
    description: 'Abbondante porzione di carne kebab servita con patatine, insalata e salse.' },
  { name: 'Pide Formaggio', price: 750, category: 'kebab', emoji: '🥖', image: 'bianca.jpg',
    description: 'Pizza turca a forma di barca con formaggio fuso e burro.' },
  { name: 'Pide Carne Macinata', price: 800, category: 'kebab', emoji: '🥖', image: 'diavola.jpg',
    description: 'Pide farcita con carne macinata speziata, pomodoro e peperoni.' },
  { name: 'Lahmacun', price: 400, category: 'kebab', emoji: '🍕', image: 'marinara.jpg',
    description: 'Sottile disco di pasta con trito di carne, erbe e spezie.' },

  // ── PIZZE COTTE NEL FORNO ─────────────────────────────────────────────────
  { name: 'Margherita', price: 600, category: 'pizze', emoji: '🍕', image: 'margherita.jpg',
    description: 'Pomodoro, mozzarella e basilico. La semplicità italiana.' },
  { name: 'Pizza Kebab', price: 900, category: 'pizze', emoji: '🌯', image: 'doner.jpg',
    description: 'La nostra specialità: pizza con pomodoro, mozzarella e carne kebab.' },
  { name: 'Diavola', price: 700, category: 'pizze', emoji: '🌶️', image: 'pizza-hot.jpg',
    description: 'Pomodoro, mozzarella e salame piccante.' },
  { name: 'Quattro Formaggi', price: 800, category: 'pizze', emoji: '🧀', image: 'quattro-formaggi.jpg',
    description: 'Mozzarella, gorgonzola, fontina e parmigiano.' },

  // ── SFIZI & CONTORNI ──────────────────────────────────────────────────────
  { name: 'Falafel (Pezzo)', price: 100, category: 'contorni', emoji: '🧆', image: 'falafel.jpg',
    description: 'Polpetta di ceci speziata e fritta.' },
  { name: 'Patatine Fritte', price: 300, category: 'contorni', emoji: '🍟', image: 'patatine.jpg',
    description: 'Porzione media di patatine croccanti.' },
  { name: 'Alette di Pollo (4pz)', price: 450, category: 'contorni', emoji: '🍗', image: 'wings.jpg',
    description: 'Sfiziose alette di pollo grigliate.' },
];

function hash(pwd) {
  return bcrypt.hashSync(pwd, 10);
}

function seedUsers() {
  const insert = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, address, phone)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const adminExists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(config.ADMIN_EMAIL);
  if (!adminExists) {
    insert.run('Bella Istanbul Admin', config.ADMIN_EMAIL, hash(config.ADMIN_PASSWORD), 'admin', null, null);
    console.log(`  ✓ Admin creato:  ${config.ADMIN_EMAIL} / ${config.ADMIN_PASSWORD}`);
  }

  const demoExists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(config.DEMO_EMAIL);
  if (!demoExists) {
    insert.run(config.DEMO_NAME, config.DEMO_EMAIL, hash(config.DEMO_PASSWORD), 'user',
      'Via Garibaldi 5, Lodi Vecchio', '339 1234567');
    console.log(`  ✓ Utente demo:   ${config.DEMO_EMAIL} / ${config.DEMO_PASSWORD}`);
  }
}

function seedPizzas() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM pizzas').get().c;
  if (count > 0) {
    console.log(`  ℹ Menu già presente (${count} prodotti).`);
    return;
  }
  console.log('  ⌛ Inserimento prodotti nel menu...');
  const insert = db.prepare(
    `INSERT INTO pizzas (name, description, price, category, emoji, image, available)
     VALUES (@name, @description, @price, @category, @emoji, @image, 1)`
  );
  const tx = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
  tx(PIZZE);
  console.log(`  ✓ ${PIZZE.length} prodotti inseriti nel menu.`);
}

function reset() {
  console.log('⚠  Reset completo del database...');
  db.exec('DELETE FROM order_items; DELETE FROM orders; DELETE FROM pizzas; DELETE FROM users;');
  db.exec('DELETE FROM sqlite_sequence;');
}

function run() {
  if (process.argv.includes('--reset')) {
    reset();
  }
  seedUsers();
  seedPizzas();
}

if (require.main === module) {
  console.log('\n🌱 Seeding database...');
  run();
  console.log('✅ Fatto.\n');
}

module.exports = { run };
