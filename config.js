const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Se non è impostato un valore esplicito via env, generiamo un segreto casuale la PRIMA volta
// e lo salviamo in un file locale (mai committato, vedi .gitignore) così resta stabile tra un
// riavvio e l'altro invece di essere una stringa fissa scritta nel codice sorgente — chiunque
// leggesse il repo pubblico potrebbe altrimenti forgiare un token admin o loggarsi come admin.
function getOrCreateLocalSecret(envValue, filename, generate) {
  if (envValue) return envValue;
  const file = path.join(__dirname, filename);
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing) return existing;
  } catch { /* file non esiste ancora: lo creiamo sotto */ }
  const value = generate();
  try { fs.writeFileSync(file, value, { mode: 0o600 }); } catch { /* filesystem read-only: usiamo comunque il valore in memoria */ }
  return value;
}

const jwtSecret = getOrCreateLocalSecret(
  process.env.JWT_SECRET, '.jwt-secret.local', () => crypto.randomBytes(32).toString('hex')
);
const adminPassword = getOrCreateLocalSecret(
  process.env.ADMIN_PASSWORD, '.admin-password.local', () => crypto.randomBytes(9).toString('base64url')
);

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: '7d',
  DB_FILE: process.env.DB_FILE || 'forno.db',

  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@fornobrace.it',
  ADMIN_PASSWORD: adminPassword,
  ADMIN_NAME: 'Forno Brace Admin',

  DEMO_EMAIL: 'marta@example.com',
  DEMO_PASSWORD: 'marta123',
  DEMO_NAME: 'Marta Bianchi',

  DELIVERY_FEE: 250,
  FREE_DELIVERY_OVER: 3000,
};
