// Logica del pannello amministratore: ordini in tempo reale, stati, gestione menu.
(function () {
  'use strict';

  const state = {
    statusFilter: 'tutti',
    tab: 'orders',
    maxOrderId: 0,
    initialized: false,
    pizzas: [],
    pollTimer: null,
  };

  const ORDER_TYPE_TEXT = { consegna: 'Consegna a domicilio', asporto: 'Asporto', tavolo: 'Al tavolo' };
  const BASE_TITLE = 'Admin · Bella Istanbul';

  // ── Suono di notifica: campanello a 3 note (Web Audio, nessun file) ────────
  function notifySound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;
      [880, 1108.7, 1318.5].forEach((f, i) => {       // A5 · C#6 · E6 (accordo)
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = f;
        const t = now + i * 0.15;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.13, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
        o.start(t); o.stop(t + 0.36);
      });
      setTimeout(() => ctx.close(), 1300);
    } catch (_) {}
  }

  // ── Notifiche desktop del browser ─────────────────────────────────────────
  function ensureNotificationPermission() {
    try {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    } catch (_) {}
  }
  function desktopNotify(title, body) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const n = new Notification(title, { body, icon: '/images/insegna.jpg', tag: 'bella-istanbul-order', renotify: true });
        n.onclick = () => { window.focus(); n.close(); };
      }
    } catch (_) {}
  }

  // ── Titolo che lampeggia quando arrivano ordini e la scheda non è attiva ──
  let unseen = 0, blinkTimer = null;
  function startTitleBlink() {
    if (blinkTimer) return;
    let on = false;
    blinkTimer = setInterval(() => {
      document.title = on ? BASE_TITLE : `🔔 (${unseen}) Nuovo ordine!`;
      on = !on;
    }, 1000);
  }
  function stopTitleBlink() {
    if (blinkTimer) { clearInterval(blinkTimer); blinkTimer = null; }
    document.title = BASE_TITLE; unseen = 0;
  }
  window.addEventListener('focus', stopTitleBlink);

  // ── Notifica completa all'arrivo di nuovi ordini ──────────────────────────
  function notifyNewOrders(newOrders) {
    const n = newOrders.length;
    notifySound();
    const first = newOrders[0];
    const extra = n === 1 ? `#${first.id} · ${euro(first.total)}` : '';
    toast(`🔔 ${n} nuovo ordine${n > 1 ? 'i' : ''}! ${extra}`, 'success');
    desktopNotify(
      n === 1 ? `Nuovo ordine #${first.id} — ${euro(first.total)}` : `${n} nuovi ordini!`,
      `${ORDER_TYPE_TEXT[first.order_type] || 'Consegna'} · ${first.delivery_name || ''}`
    );
    if (document.hidden) { unseen += n; startTitleBlink(); }
  }

  // ── Gate di autenticazione ────────────────────────────────────────────────
  function showDashboard(show) {
    document.getElementById('loginGate').style.display = show ? 'none' : '';
    document.getElementById('dashboard').style.display = show ? '' : 'none';
    document.getElementById('logoutBtn').style.display = show ? '' : 'none';
    const u = currentUser();
    document.getElementById('adminWho').textContent = show && u ? `${u.name} (${u.email})` : '';
  }

  async function adminLogin(e) {
    e.preventDefault();
    try {
      const data = await API.post('/api/auth/login', {
        email: document.getElementById('adEmail').value,
        password: document.getElementById('adPass').value,
      });
      if (data.user.role !== 'admin') {
        toast('Questo account non è un amministratore.', 'error');
        return;
      }
      setAuth(data.token, data.user);
      enterDashboard();
    } catch (err) { toast(err.message, 'error'); }
  }

  function logout() {
    clearAuth();
    if (state.pollTimer) clearInterval(state.pollTimer);
    showDashboard(false);
  }

  // ── Statistiche ───────────────────────────────────────────────────────────
  async function loadStats() {
    try {
      const s = await API.get('/api/admin/stats');
      document.getElementById('stats').innerHTML = `
        <div class="stat stat--accent"><div class="stat__label">Ordini oggi</div><div class="stat__value">${s.ordersToday}</div></div>
        <div class="stat stat--green"><div class="stat__label">Incasso oggi</div><div class="stat__value">${euro(s.revenueToday)}</div></div>
        <div class="stat"><div class="stat__label">In lavorazione</div><div class="stat__value">${s.pending}</div></div>
        <div class="stat"><div class="stat__label">Incasso totale</div><div class="stat__value">${euro(s.revenueAll)}</div></div>`;
    } catch (e) { /* silenzioso durante il polling */ }
  }

  // ── Filtro stato ──────────────────────────────────────────────────────────
  function renderStatusFilter() {
    const opts = [['tutti', 'Tutti'], ['ricevuto', 'Ricevuti'], ['in_preparazione', 'In preparazione'],
      ['in_consegna', 'In consegna'], ['consegnato', 'Consegnati'], ['annullato', 'Annullati']];
    const wrap = document.getElementById('statusFilter');
    wrap.innerHTML = opts.map(([v, l]) =>
      `<button class="pill ${v === state.statusFilter ? 'is-active' : ''}" data-st="${v}">${l}</button>`).join('');
    wrap.querySelectorAll('.pill').forEach((b) => b.addEventListener('click', () => {
      state.statusFilter = b.dataset.st; renderStatusFilter(); loadOrders();
    }));
  }

  // ── Ordini ────────────────────────────────────────────────────────────────
  async function loadOrders(silent = false) {
    const board = document.getElementById('ordersBoard');
    try {
      const q = state.statusFilter === 'tutti' ? '' : `?status=${state.statusFilter}`;
      const { orders } = await API.get('/api/orders' + q);

      // Rilevamento nuovi ordini (solo con filtro "tutti", per evitare falsi positivi).
      const maxId = orders.reduce((m, o) => Math.max(m, o.id), 0);
      let newIds = [];
      if (state.statusFilter === 'tutti') {
        if (state.initialized && maxId > state.maxOrderId) {
          const newOrders = orders.filter((o) => o.id > state.maxOrderId);
          newIds = newOrders.map((o) => o.id);
          notifyNewOrders(newOrders);
        }
        state.maxOrderId = Math.max(state.maxOrderId, maxId);
        state.initialized = true;
      }

      if (orders.length === 0) {
        board.innerHTML = `<div class="empty-state"><span class="big">🍽️</span>Nessun ordine ${state.statusFilter !== 'tutti' ? 'in questo stato' : 'ancora'}.</div>`;
        return;
      }
      board.innerHTML = orders.map((o) => orderCardHtml(o, newIds.includes(o.id))).join('');
      bindOrderActions(board);
    } catch (e) {
      if (!silent) toast(e.message, 'error');
    }
  }

  const ORDER_TYPE_BADGE = { consegna: '🛵 Consegna', asporto: '🥡 Asporto', tavolo: '🍽️ Al tavolo' };

  function adminStatusLabel(orderType, status) {
    if (orderType === 'asporto')
      return { ricevuto: 'Ricevuto', in_preparazione: 'In preparazione', in_consegna: 'Pronto', consegnato: 'Ritirato', annullato: 'Annullato' }[status] || STATUS_LABELS[status];
    if (orderType === 'tavolo')
      return { ricevuto: 'Ricevuto', in_preparazione: 'In preparazione', in_consegna: 'Pronto', consegnato: 'Servito', annullato: 'Annullato' }[status] || STATUS_LABELS[status];
    return STATUS_LABELS[status];
  }

  function orderMeta(o) {
    const parts = [`🕒 <b>${formatDate(o.created_at)}</b>`, `👤 <b>${escapeHtml(o.delivery_name)}</b>`];
    if (o.order_type === 'consegna') {
      parts.push(`📍 <b>${escapeHtml(o.delivery_address || '')}</b>`);
      if (o.delivery_phone) parts.push(`📞 <b>${escapeHtml(o.delivery_phone)}</b>`);
    } else if (o.order_type === 'asporto') {
      if (o.delivery_phone) parts.push(`📞 <b>${escapeHtml(o.delivery_phone)}</b>`);
      if (o.scheduled_time) parts.push(`🥡 ritiro <b>${escapeHtml(o.scheduled_time)}</b>`);
    } else {
      parts.push(`🍽️ <b>${o.party_size} coperti</b>`);
      if (o.scheduled_time) parts.push(`🕘 arrivo <b>${escapeHtml(o.scheduled_time)}</b>`);
    }
    return parts.map((p) => `<span>${p}</span>`).join('');
  }

  function orderCardHtml(o, isNew) {
    const statusOptions = ['ricevuto', 'in_preparazione', 'in_consegna', 'consegnato', 'annullato']
      .map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${adminStatusLabel(o.order_type, s)}</option>`).join('');
    const cust = o.customer ? `${escapeHtml(o.customer.name)} · ${escapeHtml(o.customer.email)}` : '—';
    const showMarkPaid = o.payment_status === 'in_attesa' && o.status !== 'annullato';
    return `
      <div class="admin-order s-${o.status} ${isNew ? 'is-new' : ''}">
        <div class="admin-order__head">
          <span class="order-card__id">#${o.id} · ${cust}</span>
          <div style="display:flex;gap:.4rem;flex-wrap:wrap">
            <span class="badge" style="background:#eef2ff;color:#3b54b4">${ORDER_TYPE_BADGE[o.order_type] || ORDER_TYPE_BADGE.consegna}</span>
            <span class="badge badge--${o.status}">${adminStatusLabel(o.order_type, o.status)}</span>
            <span class="badge badge--${o.payment_method}">${o.payment_method === 'carta' ? '💳 Carta' : '💶 Contanti'}</span>
            <span class="badge badge--${o.payment_status}">${PAYMENT_LABELS[o.payment_status]}</span>
          </div>
        </div>
        <div class="admin-order__meta">${orderMeta(o)}</div>
        <ul class="order-items-list">
          ${o.items.map((i) => `<li><span>${i.quantity}× ${escapeHtml(i.pizza_name)}</span><span>${euro(i.unit_price * i.quantity)}</span></li>`).join('')}
          <li style="font-weight:700;color:var(--ink);border-top:1px solid var(--line);padding-top:.4rem"><span>Totale</span><span>${euro(o.total)}</span></li>
        </ul>
        ${o.notes ? `<p class="muted" style="font-size:.85rem">📝 ${escapeHtml(o.notes)}</p>` : ''}
        <div class="admin-order__actions">
          <span class="muted" style="font-size:.85rem">Stato:</span>
          <select data-status-for="${o.id}">${statusOptions}</select>
          ${showMarkPaid ? `<button class="btn btn--green btn--sm" data-paid="${o.id}">💶 Segna pagato</button>` : ''}
        </div>
      </div>`;
  }

  function bindOrderActions(board) {
    board.querySelectorAll('select[data-status-for]').forEach((sel) =>
      sel.addEventListener('change', async () => {
        try {
          await API.patch(`/api/orders/${sel.dataset.statusFor}/status`, { status: sel.value });
          toast(`Ordine #${sel.dataset.statusFor} → ${STATUS_LABELS[sel.value]}`, 'success');
          loadStats(); loadOrders(true);
        } catch (e) { toast(e.message, 'error'); }
      }));
    board.querySelectorAll('button[data-paid]').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await API.patch(`/api/orders/${b.dataset.paid}/payment`, { payment_status: 'pagato' });
          toast(`Ordine #${b.dataset.paid} segnato come pagato.`, 'success');
          loadStats(); loadOrders(true);
        } catch (e) { toast(e.message, 'error'); }
      }));
  }

  // ── Gestione menu ─────────────────────────────────────────────────────────
  async function loadPizzas() {
    try {
      const { pizzas } = await API.get('/api/pizzas?all=1');
      state.pizzas = pizzas;
      renderPizzaTable();
    } catch (e) { toast(e.message, 'error'); }
  }

  function renderPizzaTable() {
    const t = document.getElementById('pizzaTable');
    t.innerHTML = `
      <thead><tr><th>Pizza</th><th>Categoria</th><th>Prezzo</th><th>Stato</th><th>Azioni</th></tr></thead>
      <tbody>${state.pizzas.map((p) => `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:.7rem">
              ${p.image
                ? `<img src="${p.image.startsWith('http') ? escapeHtml(p.image) : `/images/${escapeHtml(p.image)}`}" alt="" style="width:48px;height:48px;border-radius:10px;object-fit:cover;flex:none" onerror="this.style.display='none'" />`
                : `<span style="font-size:1.6rem;width:48px;text-align:center">${p.emoji}</span>`}
              <div><b>${escapeHtml(p.name)}</b><br><small class="muted">${escapeHtml(p.description)}</small></div>
            </div>
          </td>
          <td>${escapeHtml(p.category)}</td>
          <td>${euro(p.price)}</td>
          <td>${p.available
            ? '<span class="badge badge--pagato">Disponibile</span>'
            : '<span class="badge badge--fallito">Esaurita</span>'}</td>
          <td style="white-space:nowrap">
            <button class="btn btn--ghost btn--sm" data-toggle="${p.id}">${p.available ? 'Disattiva' : 'Attiva'}</button>
            <button class="btn btn--ghost btn--sm" data-edit="${p.id}">Modifica</button>
            <button class="btn btn--ghost btn--sm" data-del="${p.id}" style="color:var(--err)">Elimina</button>
          </td>
        </tr>`).join('')}</tbody>`;

    t.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
      const p = state.pizzas.find((x) => x.id === Number(b.dataset.toggle));
      try { await API.put(`/api/pizzas/${p.id}`, { available: !p.available }); loadPizzas(); }
      catch (e) { toast(e.message, 'error'); }
    }));
    t.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => openPizzaModal(state.pizzas.find((x) => x.id === Number(b.dataset.edit)))));
    t.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const p = state.pizzas.find((x) => x.id === Number(b.dataset.del));
      if (!confirm(`Eliminare "${p.name}" dal menu?`)) return;
      try { await API.del(`/api/pizzas/${p.id}`); toast('Pizza eliminata.', 'info'); loadPizzas(); }
      catch (e) { toast(e.message, 'error'); }
    }));
  }

  function openPizzaModal(pizza) {
    document.getElementById('pizzaError').textContent = '';
    document.getElementById('pizzaModalTitle').textContent = pizza ? 'Modifica pizza' : 'Nuova pizza';
    document.getElementById('pzId').value = pizza ? pizza.id : '';
    document.getElementById('pzName').value = pizza ? pizza.name : '';
    document.getElementById('pzEmoji').value = pizza ? pizza.emoji : '🍕';
    document.getElementById('pzDesc').value = pizza ? pizza.description : '';
    document.getElementById('pzPrice').value = pizza ? (pizza.price / 100).toFixed(2) : '';
    document.getElementById('pzCat').value = pizza ? pizza.category : 'classiche';
    document.getElementById('pzImage').value = pizza ? (pizza.image || '') : '';
    document.getElementById('pzAvail').checked = pizza ? !!pizza.available : true;
    document.getElementById('pizzaModalOverlay').classList.add('is-open');
  }
  function closePizzaModal() { document.getElementById('pizzaModalOverlay').classList.remove('is-open'); }

  async function savePizza() {
    const id = document.getElementById('pzId').value;
    const euros = parseFloat(document.getElementById('pzPrice').value);
    if (!document.getElementById('pzName').value.trim()) {
      document.getElementById('pizzaError').textContent = 'Inserisci il nome.'; return;
    }
    if (!Number.isFinite(euros) || euros < 0) {
      document.getElementById('pizzaError').textContent = 'Prezzo non valido.'; return;
    }
    const payload = {
      name: document.getElementById('pzName').value.trim(),
      emoji: document.getElementById('pzEmoji').value.trim() || '🍕',
      description: document.getElementById('pzDesc').value.trim(),
      price: Math.round(euros * 100),
      category: document.getElementById('pzCat').value,
      image: document.getElementById('pzImage').value,
      available: document.getElementById('pzAvail').checked,
    };
    try {
      if (id) await API.put(`/api/pizzas/${id}`, payload);
      else await API.post('/api/pizzas', payload);
      toast('Menu aggiornato.', 'success');
      closePizzaModal();
      loadPizzas();
    } catch (e) { document.getElementById('pizzaError').textContent = e.message; }
  }

  // ── Tab ───────────────────────────────────────────────────────────────────
  function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.admin-tabs button').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.tab === tab));
    document.getElementById('tabOrders').style.display = tab === 'orders' ? '' : 'none';
    document.getElementById('tabMenu').style.display = tab === 'menu' ? '' : 'none';
    if (tab === 'menu') loadPizzas();
    if (tab === 'orders') loadOrders();
  }

  // ── Polling ───────────────────────────────────────────────────────────────
  function startPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    // Continua il polling anche con la scheda in background, così la notifica
    // (suono + notifica desktop + titolo lampeggiante) arriva comunque.
    state.pollTimer = setInterval(() => {
      if (!document.getElementById('autoRefresh').checked) return;
      loadStats();
      if (state.tab === 'orders') loadOrders(true);
    }, 5000);
  }

  function enterDashboard() {
    showDashboard(true);
    ensureNotificationPermission();
    renderStatusFilter();
    loadStats();
    loadOrders();
    startPolling();
  }

  // ── Avvio ─────────────────────────────────────────────────────────────────
  function init() {
    document.getElementById('adminLoginForm').addEventListener('submit', adminLogin);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.querySelectorAll('.admin-tabs button').forEach((b) =>
      b.addEventListener('click', () => switchTab(b.dataset.tab)));
    document.getElementById('addPizzaBtn').addEventListener('click', () => openPizzaModal(null));
    document.getElementById('closePizzaModal').addEventListener('click', closePizzaModal);
    document.getElementById('savePizzaBtn').addEventListener('click', savePizza);
    document.getElementById('pizzaModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'pizzaModalOverlay') closePizzaModal();
    });

    // Pulsante "Attiva notifiche" (richiede il permesso con un click dell'utente)
    const notifBtn = document.getElementById('enableNotif');
    if (notifBtn) {
      const refreshNotifBtn = () => {
        if (!('Notification' in window)) { notifBtn.style.display = 'none'; return; }
        if (Notification.permission === 'granted') { notifBtn.textContent = '🔔 Notifiche attive'; notifBtn.disabled = true; }
        else if (Notification.permission === 'denied') { notifBtn.textContent = '🔕 Notifiche bloccate'; notifBtn.disabled = true; }
        else { notifBtn.textContent = '🔔 Attiva notifiche'; notifBtn.disabled = false; }
      };
      notifBtn.addEventListener('click', () => {
        if (!('Notification' in window)) return;
        Notification.requestPermission().then(() => {
          refreshNotifBtn();
          if (Notification.permission === 'granted') {
            desktopNotify('Notifiche attive ✓', 'Riceverai un avviso ad ogni nuovo ordine.');
            notifySound();
          }
        });
      });
      refreshNotifBtn();
    }

    const u = currentUser();
    if (API.token() && u && u.role === 'admin') enterDashboard();
    else showDashboard(false);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
