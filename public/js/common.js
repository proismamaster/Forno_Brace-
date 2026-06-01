// Utility condivise tra sito utente e pannello admin.

// ── Chiamate API ────────────────────────────────────────────────────────────
const API = {
  token: () => localStorage.getItem('pizza_token'),
  async call(method, pathUrl, body) {
    const headers = { 'Content-Type': 'application/json' };
    const t = API.token();
    if (t) headers.Authorization = 'Bearer ' + t;
    const res = await fetch(pathUrl, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error(data.error || 'Si è verificato un errore.');
      err.status = res.status;
      err.code = data.code;
      throw err;
    }
    return data;
  },
  get: (p) => API.call('GET', p),
  post: (p, b) => API.call('POST', p, b),
  put: (p, b) => API.call('PUT', p, b),
  patch: (p, b) => API.call('PATCH', p, b),
  del: (p) => API.call('DELETE', p),
};

// ── Autenticazione (lato client) ────────────────────────────────────────────
function currentUser() {
  try { return JSON.parse(localStorage.getItem('pizza_user')); } catch { return null; }
}
function setAuth(token, user) {
  localStorage.setItem('pizza_token', token);
  localStorage.setItem('pizza_user', JSON.stringify(user));
}
function clearAuth() {
  localStorage.removeItem('pizza_token');
  localStorage.removeItem('pizza_user');
}

// ── Formattazione ───────────────────────────────────────────────────────────
function euro(cents) {
  return (Number(cents) / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatDate(iso) {
  // Le date dal DB sono in UTC ("YYYY-MM-DD HH:MM:SS"). Le interpretiamo come tali.
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return iso;
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ── Etichette / colori di stato ─────────────────────────────────────────────
const STATUS_LABELS = {
  ricevuto: 'Ricevuto',
  in_preparazione: 'In preparazione',
  in_consegna: 'In consegna',
  consegnato: 'Consegnato',
  annullato: 'Annullato',
};
const STATUS_FLOW = ['ricevuto', 'in_preparazione', 'in_consegna', 'consegnato'];
const PAYMENT_LABELS = { in_attesa: 'In attesa', pagato: 'Pagato', fallito: 'Fallito' };

// ── Toast notifiche ─────────────────────────────────────────────────────────
function toast(message, type = 'info') {
  let wrap = document.getElementById('toasts');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toasts';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast--show'));
  setTimeout(() => {
    el.classList.remove('toast--show');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}
