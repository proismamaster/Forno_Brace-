// Configurazione centrale dell'applicazione.
// In produzione imposta queste variabili tramite variabili d'ambiente.
module.exports = {
  PORT: process.env.PORT || 3000,
  // Chiave segreta per firmare i token JWT. CAMBIALA in produzione!
  JWT_SECRET: process.env.JWT_SECRET || 'pizzeria-bella-napoli-secret-key-2024',
  JWT_EXPIRES_IN: '7d',
  DB_FILE: process.env.DB_FILE || 'pizzeria.db',

  // Account amministratore creato automaticamente al primo avvio.
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@pizzeria.it',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
  ADMIN_NAME: 'Amministratore',

  // Account utente demo creato automaticamente (per provare velocemente).
  DEMO_EMAIL: 'mario@example.com',
  DEMO_PASSWORD: 'mario123',
  DEMO_NAME: 'Mario Rossi',

  // Costo di consegna in centesimi (es. 250 = 2,50 €). 0 = gratis.
  DELIVERY_FEE: 250,
  // Soglia in centesimi sopra la quale la consegna è gratuita (es. 2000 = 20 €).
  FREE_DELIVERY_OVER: 2000,
};
