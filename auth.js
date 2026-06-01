// Gestione autenticazione: creazione token JWT e middleware di protezione.
const jwt = require('jsonwebtoken');
const config = require('./config');

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
}

// Estrae e verifica il token dall'header "Authorization: Bearer <token>".
function getUserFromRequest(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch {
    return null;
  }
}

// Richiede un utente autenticato (qualsiasi ruolo).
function requireAuth(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Devi effettuare l\'accesso.' });
  req.user = user;
  next();
}

// Richiede un utente con ruolo admin.
function requireAdmin(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Devi effettuare l\'accesso.' });
  if (user.role !== 'admin') return res.status(403).json({ error: 'Accesso riservato all\'amministratore.' });
  req.user = user;
  next();
}

module.exports = { signToken, getUserFromRequest, requireAuth, requireAdmin };
