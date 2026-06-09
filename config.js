module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'forno-brace-secret-key-2025',
  JWT_EXPIRES_IN: '7d',
  DB_FILE: process.env.DB_FILE || 'forno.db',

  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@fornobrace.it',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
  ADMIN_NAME: 'Forno Brace Admin',

  DEMO_EMAIL: 'marta@example.com',
  DEMO_PASSWORD: 'marta123',
  DEMO_NAME: 'Marta Bianchi',

  DELIVERY_FEE: 250,
  FREE_DELIVERY_OVER: 3000,
};
