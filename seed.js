// Popola il database con un menu di pizze, un account admin e un utente demo.
// Uso:
//   node seed.js          -> popola solo se il database è vuoto
//   node seed.js --reset  -> svuota e ripopola tutto (cancella ordini/utenti!)
const bcrypt = require('bcryptjs');
const db = require('./db');
const config = require('./config');

const PIZZE = [
  // classiche
  { name: 'Margherita', price: 650, category: 'classiche', emoji: '🍕', image: 'margherita.jpg',
    description: 'Pomodoro San Marzano, mozzarella fior di latte, basilico fresco, olio EVO.' },
  { name: 'Marinara', price: 550, category: 'classiche', emoji: '🍅', image: 'marinara.jpg',
    description: 'Pomodoro, aglio, origano e olio extravergine. La più antica.' },
  { name: 'Napoli', price: 750, category: 'classiche', emoji: '🐟', image: 'capricciosa.jpg',
    description: 'Pomodoro, mozzarella, acciughe, capperi e origano.' },
  { name: 'Prosciutto', price: 800, category: 'classiche', emoji: '🍖', image: 'boscaiola.jpg',
    description: 'Pomodoro, mozzarella e prosciutto cotto.' },
  { name: 'Prosciutto e Funghi', price: 850, category: 'classiche', emoji: '🍄', image: 'funghi.jpg',
    description: 'Pomodoro, mozzarella, prosciutto cotto e funghi champignon.' },

  // speciali
  { name: 'Diavola', price: 850, category: 'speciali', emoji: '🌶️', image: 'diavola.jpg',
    description: 'Pomodoro, mozzarella e salame piccante. Per chi ama il fuoco.' },
  { name: 'Capricciosa', price: 950, category: 'speciali', emoji: '🎭', image: 'capricciosa.jpg',
    description: 'Pomodoro, mozzarella, prosciutto, funghi, carciofi e olive.' },
  { name: 'Quattro Stagioni', price: 950, category: 'speciali', emoji: '🍂', image: 'quattro-stagioni.jpg',
    description: 'Quattro spicchi: funghi, carciofi, prosciutto e olive.' },
  { name: 'Boscaiola', price: 950, category: 'speciali', emoji: '🌲', image: 'boscaiola.jpg',
    description: 'Mozzarella, funghi porcini, salsiccia e panna.' },
  { name: 'Bufalina', price: 1000, category: 'speciali', emoji: '🧀', image: 'bufalina.jpg',
    description: 'Pomodoro, mozzarella di bufala DOP e basilico.' },
  { name: 'Calzone Farcito', price: 950, category: 'speciali', emoji: '🥟', image: 'pizza-hot.jpg',
    description: 'Ripieno di pomodoro, mozzarella, prosciutto cotto e ricotta.' },

  // bianche (senza pomodoro)
  { name: 'Quattro Formaggi', price: 950, category: 'bianche', emoji: '🧀', image: 'quattro-formaggi.jpg',
    description: 'Mozzarella, gorgonzola, fontina e parmigiano. Tutta cremosità.' },
  { name: 'Patate e Salsiccia', price: 950, category: 'bianche', emoji: '🥔', image: 'bianca.jpg',
    description: 'Mozzarella, patate a fette, salsiccia e rosmarino.' },
  { name: 'Tonno e Cipolla', price: 900, category: 'bianche', emoji: '🧅', image: 'bianca.jpg',
    description: 'Mozzarella, tonno e cipolla di Tropea.' },

  // vegetariane
  { name: 'Vegetariana', price: 900, category: 'vegetariane', emoji: '🥦', image: 'vegetariana.jpg',
    description: 'Pomodoro, mozzarella e verdure grigliate di stagione.' },
  { name: 'Ortolana', price: 900, category: 'vegetariane', emoji: '🥬', image: 'vegetariana.jpg',
    description: 'Pomodoro, mozzarella, zucchine, melanzane e peperoni.' },
  { name: 'Parmigiana', price: 950, category: 'vegetariane', emoji: '🍆', image: 'funghi.jpg',
    description: 'Pomodoro, mozzarella, melanzane fritte e parmigiano.' },
  { name: 'Margherita Veg', price: 850, category: 'vegetariane', emoji: '🌱', image: 'margherita.jpg',
    description: 'Pomodoro, mozzarella vegetale e basilico. 100% plant-based.' },
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
      'Via Roma 12, Napoli', '333 1234567');
    console.log(`  ✓ Utente demo:   ${config.DEMO_EMAIL} / ${config.DEMO_PASSWORD}`);
  }
}

function seedPizzas() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM pizzas').get().c;
  if (count > 0) return;
  const insert = db.prepare(
    `INSERT INTO pizzas (name, description, price, category, emoji, image, available)
     VALUES (@name, @description, @price, @category, @emoji, @image, 1)`
  );
  const tx = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
  tx(PIZZE);
  console.log(`  ✓ ${PIZZE.length} pizze inserite nel menu`);
}

function reset() {
  console.log('⚠  Reset completo del database...');
  db.exec('DELETE FROM order_items; DELETE FROM orders; DELETE FROM pizzas; DELETE FROM users;');
  db.exec("DELETE FROM sqlite_sequence;");
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
