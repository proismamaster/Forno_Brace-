// Popola il database con il menu della Pizzeria Vulcano, un account admin e un utente demo.
// Uso:
//   node seed.js          -> popola solo se il database è vuoto
//   node seed.js --reset  -> svuota e ripopola tutto (cancella ordini/utenti!)
const bcrypt = require('bcryptjs');
const db = require('./db');
const config = require('./config');

// Le immagini sono file locali in /public/images (scaricate e verificate),
// così non dipendono da servizi esterni e si caricano sempre.
const PIZZE = [
  // ── PIZZE ─────────────────────────────────────────────────────────────────
  { name: 'Vulcano', price: 800, category: 'pizze', emoji: '🌋', image: 'diavola.jpg',
    description: 'La nostra pizza simbolo: pomodoro, mozzarella, salame piccante, \'nduja e peperoncino. Esplosiva!' },
  { name: 'Margherita', price: 450, category: 'pizze', emoji: '🍕', image: 'margherita.jpg',
    description: 'Pomodoro, mozzarella fior di latte, basilico fresco e olio EVO.' },
  { name: 'Marinara', price: 400, category: 'pizze', emoji: '🍅', image: 'marinara.jpg',
    description: 'Pomodoro, aglio, origano e olio extravergine. La più antica.' },
  { name: 'Diavola', price: 600, category: 'pizze', emoji: '🌶️', image: 'pizza-hot.jpg',
    description: 'Pomodoro, mozzarella e salame piccante. Per chi ama il fuoco.' },
  { name: 'Prosciutto e Funghi', price: 650, category: 'pizze', emoji: '🍄', image: 'funghi.jpg',
    description: 'Pomodoro, mozzarella, prosciutto cotto e funghi champignon.' },
  { name: 'Capricciosa', price: 700, category: 'pizze', emoji: '🎭', image: 'capricciosa.jpg',
    description: 'Pomodoro, mozzarella, prosciutto, funghi, carciofi e olive.' },
  { name: 'Quattro Stagioni', price: 700, category: 'pizze', emoji: '🍂', image: 'quattro-stagioni.jpg',
    description: 'Quattro spicchi: funghi, carciofi, prosciutto cotto e olive.' },
  { name: 'Boscaiola', price: 700, category: 'pizze', emoji: '🌲', image: 'boscaiola.jpg',
    description: 'Mozzarella, funghi, salsiccia e un tocco di panna.' },
  { name: 'Quattro Formaggi', price: 700, category: 'pizze', emoji: '🧀', image: 'quattro-formaggi.jpg',
    description: 'Mozzarella, gorgonzola, fontina e parmigiano. Tutta cremosità.' },
  { name: 'Bufalina', price: 750, category: 'pizze', emoji: '🧀', image: 'bufalina.jpg',
    description: 'Pomodoro, mozzarella di bufala campana e basilico.' },
  { name: 'Vegetariana', price: 650, category: 'pizze', emoji: '🥬', image: 'vegetariana.jpg',
    description: 'Pomodoro, mozzarella e verdure grigliate di stagione.' },

  // ── KEBAB ───────────────────────────────────────────────────────────────
  { name: 'Panino Kebab', price: 550, category: 'kebab', emoji: '🥙', image: 'kebab-panino.jpg',
    description: 'Pane arabo con carne kebab, insalata, pomodoro, cipolla e salse a scelta.' },
  { name: 'Piadina Kebab', price: 550, category: 'kebab', emoji: '🌯', image: 'kebab-piadina.jpg',
    description: 'Piadina farcita con carne kebab, verdure fresche e salse artigianali.' },
  { name: 'Pizza Kebab', price: 800, category: 'kebab', emoji: '🌋', image: 'doner.jpg',
    description: 'Base pizza con pomodoro, mozzarella e abbondante carne kebab.' },
  { name: 'Piatto Kebab', price: 850, category: 'kebab', emoji: '🍽️', image: 'kebab-piatto.jpg',
    description: 'Abbondante carne kebab servita con patatine fritte, insalata e salse.' },

  // ── HAMBURGER ─────────────────────────────────────────────────────────────
  { name: 'Hamburger Vulcano', price: 700, category: 'hamburger', emoji: '🍔', image: 'hamburger.jpg',
    description: 'Doppia carne di manzo, cheddar, bacon, insalata, pomodoro e salsa della casa.' },

  // ── CONTORNI ──────────────────────────────────────────────────────────────
  { name: 'Patatine Fritte', price: 350, category: 'contorni', emoji: '🍟', image: 'patatine.jpg',
    description: 'Croccanti patatine fritte. Aggiungi la salsa che preferisci.' },
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
    insert.run(config.ADMIN_NAME, config.ADMIN_EMAIL, hash(config.ADMIN_PASSWORD), 'admin', null, null);
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

function run({ force = false } = {}) {
  if (force) reset();
  seedUsers();
  seedPizzas();
}

// Esecuzione diretta da riga di comando.
if (require.main === module) {
  const force = process.argv.includes('--reset');
  console.log('🌱 Seeding database...');
  run({ force });
  console.log('✅ Fatto.');
  process.exit(0);
}

module.exports = { run, PIZZE };
