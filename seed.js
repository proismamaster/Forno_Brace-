// Popola il database con un menu di pizze, un account admin e un utente demo.
// Uso:
//   node seed.js          -> popola solo se il database è vuoto
//   node seed.js --reset  -> svuota e ripopola tutto (cancella ordini/utenti!)
const bcrypt = require('bcryptjs');
const db = require('./db');
const config = require('./config');

const PIZZE = [
  // Pizze Classiche
  { name: 'Margherita', price: 600, category: 'pizze', emoji: '🍕', image: 'margherita.jpg',
    description: 'Pomodoro, mozzarella e basilico. La semplicità vulcanica.' },
  { name: 'Diavola', price: 750, category: 'pizze', emoji: '🌶️', image: 'diavola.jpg',
    description: 'Pomodoro, mozzarella e salame piccante. Un classico piccante.' },
  { name: 'Prosciutto e Funghi', price: 800, category: 'pizze', emoji: '🍄', image: 'funghi.jpg',
    description: 'Pomodoro, mozzarella, prosciutto cotto e funghi freschi.' },
  { name: 'Quattro Stagioni', price: 850, category: 'pizze', emoji: '🍂', image: 'quattro-stagioni.jpg',
    description: 'Pomodoro, mozzarella, funghi, carciofi, prosciutto cotto e olive.' },
  
  // Specialità Kebab
  { name: 'Panino Kebab', price: 650, category: 'kebab', emoji: '🥙', image: 'pizza-hot.jpg',
    description: 'Carne kebab, insalata, pomodoro, cipolla e salse a scelta.' },
  { name: 'Piadina Kebab', price: 650, category: 'kebab', emoji: '🌯', image: 'bianca.jpg',
    description: 'Piadina con carne kebab, verdure fresche e salse artigianali.' },
  { name: 'Pizza Kebab', price: 900, category: 'kebab', emoji: '🍕', image: 'bufalina.jpg',
    description: 'Pomodoro, mozzarella e abbondante carne kebab.' },
  { name: 'Piatto Kebab', price: 900, category: 'kebab', emoji: '🍽️', image: 'vegetariana.jpg',
    description: 'Carne kebab servita con patatine fritte, insalata e salse.' },

  // Altro
  { name: 'Hamburger Classico', price: 600, category: 'hamburger', emoji: '🍔', image: 'sala.jpg',
    description: 'Pane, carne 100% manzo, insalata e pomodoro.' },
  { name: 'Patatine Fritte', price: 350, category: 'contorni', emoji: '🍟', image: 'forno.jpg',
    description: 'Porzione di patatine fritte croccanti.' },
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
  if (count > 0) {
    console.log(`  ℹ Menu già presente (${count} pizze).`);
    return;
  }
  console.log('  ⌛ Inserimento pizze nel menu...');
  const insert = db.prepare(
    `INSERT INTO pizzas (name, description, price, category, emoji, image, available)
     VALUES (@name, @description, @price, @category, @emoji, @image, 1)`
  );
  const tx = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
  tx(PIZZE);
  console.log(`  ✓ ${PIZZE.length} pizze inserite nel menu.`);
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
