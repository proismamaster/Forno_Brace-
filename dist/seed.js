const bcrypt = require('bcryptjs');
const db = require('./db');
const config = require('./config');

const U = (id, w, h) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=80`;

const UNS = {
  bread:     '1509440159596-0249088772ff',
  pizza:     '1565299624946-b28f40a0ae38',
  coffee:    '1509042239860-f550ce710b93',
  tart:      '1464349095431-e9a21285b5f3',
  bowl:      '1540189549336-e6e99c3679fe',
};

const U2 = (id, w, h) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=fill&q=80`;
const U3 = (id, w, h) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=clip&q=80`;

const PRODUCTS = [
  {
    name: 'Pane di Campagna',
    price: 450,
    category: 'pani',
    emoji: '\uD83C\uDF5E',
    image: U(UNS.bread, 600, 400),
    images: JSON.stringify([U(UNS.bread, 600, 400), U2(UNS.bread, 600, 400), U3(UNS.bread, 600, 400)]),
    quantity: 100,
    description: 'Pasta madre viva, farina macinata a pietra, crosta spessa e mollica alveolata. Fatto a mano ogni notte.',
  },
  {
    name: 'Focaccia Genovese',
    price: 350,
    category: 'pani',
    emoji: '\uD83E\uDED3',
    image: U(UNS.pizza, 600, 400),
    images: JSON.stringify([U(UNS.pizza, 600, 400), U2(UNS.pizza, 600, 400)]),
    quantity: 100,
    description: 'Soffice e unta al punto giusto, con olive taggiasche e sale grosso di Cervia.',
  },
  {
    name: 'Pizza in Pala',
    price: 550,
    category: 'pani',
    emoji: '\uD83C\uDF55',
    image: U(UNS.pizza, 600, 400),
    images: JSON.stringify([U(UNS.pizza, 600, 400), U2(UNS.pizza, 600, 400), U3(UNS.pizza, 600, 400)]),
    quantity: 100,
    description: 'Lunga lievitazione, pomodoro San Marzano e fiordilatte. Alta, croccante fuori e morbida dentro.',
  },
  {
    name: 'Cornetto Artigianale',
    price: 280,
    category: 'dolci',
    emoji: '\uD83E\uDD50',
    image: U(UNS.tart, 600, 400),
    images: JSON.stringify([U(UNS.tart, 600, 400), U2(UNS.tart, 600, 400)]),
    quantity: 100,
    description: 'Sfogliato a mano con burro di centrifuga francese e crema pasticcera alla vaniglia del Madagascar.',
  },
  {
    name: 'Crostata del Giorno',
    price: 400,
    category: 'dolci',
    emoji: '\uD83E\uDD67',
    image: U(UNS.tart, 600, 400),
    images: JSON.stringify([U(UNS.tart, 600, 400), U2(UNS.tart, 600, 400)]),
    quantity: 100,
    description: 'Frolla al burro e confettura di frutta di stagione. Cambia ogni giorno — chiedi di cosa sa oggi.',
  },
  {
    name: 'Zuppa della Bottega',
    price: 750,
    category: 'piatti',
    emoji: '\uD83C\uDF72',
    image: U(UNS.bowl, 600, 400),
    images: JSON.stringify([U(UNS.bowl, 600, 400), U2(UNS.bowl, 600, 400)]),
    quantity: 100,
    description: 'Ricetta che cambia con il mercato: legumi e cereali, verdure di campo, crostino all\'aglio.',
  },
  {
    name: 'Insalata di Farro',
    price: 700,
    category: 'piatti',
    emoji: '\uD83E\uDD57',
    image: U(UNS.bowl, 600, 400),
    images: JSON.stringify([U(UNS.bowl, 600, 400), U2(UNS.bowl, 600, 400)]),
    quantity: 100,
    description: 'Farro perlato bio, pomodorini confit, olive nere, basilico fresco e scaglie di grana.',
  },
  {
    name: 'Caffè della Bottega',
    price: 180,
    category: 'bevande',
    emoji: '\u2615',
    image: U(UNS.coffee, 600, 400),
    images: JSON.stringify([U(UNS.coffee, 600, 400), U2(UNS.coffee, 600, 400)]),
    quantity: 100,
    description: 'Miscela arabica tostata da un piccolo torrefattore di quartiere. Lungo, corto o macchiato.',
  },
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
    console.log(`  Admin creato:  ${config.ADMIN_EMAIL} / ${config.ADMIN_PASSWORD}`);
  }

  const demoExists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(config.DEMO_EMAIL);
  if (!demoExists) {
    insert.run(config.DEMO_NAME, config.DEMO_EMAIL, hash(config.DEMO_PASSWORD), 'user',
      'Via dei Forni 14, Milano', '339 1234567');
    console.log(`  Utente demo:   ${config.DEMO_EMAIL} / ${config.DEMO_PASSWORD}`);
  }
}

function seedProducts() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (count > 0) {
    console.log(`  Menu già presente (${count} prodotti).`);
    return;
  }
  console.log('  Inserimento prodotti nel menu...');
  const insert = db.prepare(
    `INSERT INTO products (name, description, price, category, emoji, image, images, available, quantity)
     VALUES (@name, @description, @price, @category, @emoji, @image, @images, 1, @quantity)`
  );
  const tx = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
  tx(PRODUCTS);
  console.log(`  ${PRODUCTS.length} prodotti inseriti nel menu.`);
}

function reset() {
  console.log('Reset completo del database...');
  db.exec('DELETE FROM order_items; DELETE FROM orders; DELETE FROM products; DELETE FROM users;');
  db.exec('DELETE FROM sqlite_sequence;');
}

function run() {
  if (process.argv.includes('--reset')) {
    reset();
  }
  seedUsers();
  seedProducts();
}

if (require.main === module) {
  console.log('\nSeeding database...');
  run();
  console.log('Fatto.\n');
}

module.exports = { run };
