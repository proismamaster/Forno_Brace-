(function () {
  'use strict';

  const state = {
    statusFilter: 'tutti',
    tab: 'orders',
    maxOrderId: 0,
    initialized: false,
    products: [],
    pollTimer: null,
  };

  const ORDER_TYPE_TEXT = { consegna: 'Consegna a domicilio', asporto: 'Asporto', tavolo: 'Al tavolo' };
  const BASE_TITLE = 'Gestione · Forno Brace';

  function notifySound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;
      [880, 1108.7, 1318.5].forEach((f, i) => {
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

  function ensureNotificationPermission() {
    try {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    } catch (_) {}
  }
  function desktopNotify(title, body) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const n = new Notification(title, { body, tag: 'forno-brace-order', renotify: true });
        n.onclick = () => { window.focus(); n.close(); };
      }
    } catch (_) {}
  }

  let unseen = 0, blinkTimer = null;
  function startTitleBlink() {
    if (blinkTimer) return;
    let on = false;
    blinkTimer = setInterval(() => {
      document.title = on ? BASE_TITLE : `\u26AB (${unseen}) Nuovo ordine!`;
      on = !on;
    }, 1000);
  }
  function stopTitleBlink() {
    if (blinkTimer) { clearInterval(blinkTimer); blinkTimer = null; }
    document.title = BASE_TITLE; unseen = 0;
  }
  window.addEventListener('focus', stopTitleBlink);

  function notifyNewOrders(newOrders) {
    const n = newOrders.length;
    notifySound();
    const first = newOrders[0];
    toast(`Nuovo ordine${n > 1 ? 'i' : ''}! #${first.id} · ${euro(first.total)}`, 'success');
    desktopNotify(
      n === 1 ? `Nuovo ordine #${first.id} — ${euro(first.total)}` : `${n} nuovi ordini!`,
      `${ORDER_TYPE_TEXT[first.order_type] || 'Consegna'} · ${first.delivery_name || ''}`
    );
    if (document.hidden) { unseen += n; startTitleBlink(); }
  }

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

  async function loadStats() {
    try {
      const s = await API.get('/api/admin/stats');
      document.getElementById('stats').innerHTML = `
        <div class="stat"><div class="stat__label">Ordini oggi</div><div class="stat__value">${s.ordersToday}</div></div>
        <div class="stat"><div class="stat__label">Incasso oggi</div><div class="stat__value">${euro(s.revenueToday)}</div></div>
        <div class="stat"><div class="stat__label">In lavorazione</div><div class="stat__value">${s.pending}</div></div>
        <div class="stat"><div class="stat__label">Incasso totale</div><div class="stat__value">${euro(s.revenueAll)}</div></div>`;
    } catch (e) { /* silenzioso */ }
  }

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

  async function loadOrders(silent = false) {
    const board = document.getElementById('ordersBoard');
    try {
      const q = state.statusFilter === 'tutti' ? '' : `?status=${state.statusFilter}`;
      const { orders } = await API.get('/api/orders' + q);

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
        board.innerHTML = `<div class="empty-state">Nessun ordine ${state.statusFilter !== 'tutti' ? 'in questo stato' : 'ancora'}.</div>`;
        return;
      }
      board.innerHTML = orders.map((o) => orderCardHtml(o, newIds.includes(o.id))).join('');
      bindOrderActions(board);
    } catch (e) {
      if (!silent) toast(e.message, 'error');
    }
  }

  const ORDER_TYPE_BADGE = { consegna: 'Consegna', asporto: 'Asporto', tavolo: 'Al tavolo' };

  function adminStatusLabel(orderType, status) {
    if (orderType === 'asporto')
      return { ricevuto: 'Ricevuto', in_preparazione: 'In preparazione', in_consegna: 'Pronto', consegnato: 'Ritirato', annullato: 'Annullato' }[status] || STATUS_LABELS[status];
    if (orderType === 'tavolo')
      return { ricevuto: 'Ricevuto', in_preparazione: 'In preparazione', in_consegna: 'Pronto', consegnato: 'Servito', annullato: 'Annullato' }[status] || STATUS_LABELS[status];
    return STATUS_LABELS[status];
  }

  function orderMeta(o) {
    const parts = [`${formatDate(o.created_at)}`, `${escapeHtml(o.delivery_name)}`];
    if (o.order_type === 'consegna') {
      parts.push(`${escapeHtml(o.delivery_address || '')}`);
      if (o.delivery_phone) parts.push(`${escapeHtml(o.delivery_phone)}`);
    } else if (o.order_type === 'asporto') {
      if (o.delivery_phone) parts.push(`${escapeHtml(o.delivery_phone)}`);
      if (o.scheduled_time) parts.push(`ritiro ${escapeHtml(o.scheduled_time)}`);
    } else {
      parts.push(`${o.party_size} coperti`);
      if (o.scheduled_time) parts.push(`arrivo ${escapeHtml(o.scheduled_time)}`);
    }
    return parts.map((p) => `<span>${p}</span>`).join(' · ');
  }

  function orderCardHtml(o, isNew) {
    const statusOptions = ['ricevuto', 'in_preparazione', 'in_consegna', 'consegnato', 'annullato']
      .map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${adminStatusLabel(o.order_type, s)}</option>`).join('');
    const cust = o.customer ? `${escapeHtml(o.customer.name)} · ${escapeHtml(o.customer.email)}` : '—';
    const showMarkPaid = o.payment_status === 'in_attesa' && o.status !== 'annullato';
    return `
      <div class="order-card ${isNew ? 'is-new' : ''}">
        <div class="order-card__header">
          <span class="order-card__id">#${o.id} · ${cust}</span>
          <div style="display:flex;gap:.35rem;flex-wrap:wrap">
            <span class="status-badge" style="background:rgba(61,40,23,.06);color:var(--brown)">${ORDER_TYPE_BADGE[o.order_type] || ORDER_TYPE_BADGE.consegna}</span>
            <span class="status-badge status-${o.status}">${adminStatusLabel(o.order_type, o.status)}</span>
            <span class="status-badge" style="background:rgba(200,85,42,.06);color:var(--terracotta)">${o.payment_method === 'carta' ? 'Carta' : 'Contanti'}</span>
            <span class="status-badge" style="background:rgba(74,93,42,.08);color:var(--olive)">${PAYMENT_LABELS[o.payment_status]}</span>
          </div>
        </div>
        <div class="order-card__date">${orderMeta(o)}</div>
        <div style="margin:.5rem 0;font-size:.9rem">
          ${o.items.map((i) => `<div class="summary-row"><span>${i.quantity}&times; ${escapeHtml(i.product_name)}</span><span>${euro(i.unit_price * i.quantity)}</span></div>`).join('')}
          <div class="summary-row" style="font-weight:700;color:var(--brown);border-top:1px solid var(--line);padding-top:.4rem;margin-top:.2rem"><span>Totale</span><span>${euro(o.total)}</span></div>
        </div>
        ${o.notes ? `<p class="muted" style="font-size:.85rem">${escapeHtml(o.notes)}</p>` : ''}
        <div style="display:flex;align-items:center;gap:.6rem;margin-top:.6rem;flex-wrap:wrap">
          <span class="muted" style="font-size:.85rem">Stato:</span>
          <select data-status-for="${o.id}" style="padding:.35em .7em;border-radius:8px;border:1.5px solid var(--line-dark);background:var(--cream);font-family:var(--font-heading);font-size:.85rem">${statusOptions}</select>
          ${showMarkPaid ? `<button class="btn btn--olive btn--sm" data-paid="${o.id}">Segna pagato</button>` : ''}
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

  async function loadProducts() {
    try {
      const { products } = await API.get('/api/products?all=1');
      state.products = products;
      renderProductTable();
    } catch (e) { toast(e.message, 'error'); }
  }

  function renderProductTable() {
    const t = document.getElementById('pizzaTable');
    t.innerHTML = `
      <thead><tr><th>Prodotto</th><th>Categoria</th><th>Prezzo</th><th>Stato</th><th>Azioni</th></tr></thead>
      <tbody>${state.products.map((p) => `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:.7rem">
              ${p.image
                ? `<img src="${p.image}" alt="" style="width:48px;height:48px;border-radius:10px;object-fit:cover;flex:none" onerror="this.style.display='none'" />`
                : `<span style="font-size:1.6rem;width:48px;text-align:center">${p.emoji}</span>`}
              <div><b>${escapeHtml(p.name)}</b><br><small class="muted">${escapeHtml(p.description)}</small></div>
            </div>
          </td>
          <td>${escapeHtml(p.category)}</td>
          <td>${euro(p.price)}</td>
          <td>${p.available
            ? '<span class="status-badge" style="background:rgba(74,124,63,.08);color:var(--green)">Disponibile</span>'
            : '<span class="status-badge" style="background:rgba(184,50,39,.08);color:var(--err)">Esaurito</span>'}</td>
          <td style="white-space:nowrap">
            <button class="btn btn--ghost btn--sm" data-toggle="${p.id}">${p.available ? 'Disattiva' : 'Attiva'}</button>
            <button class="btn btn--ghost btn--sm" data-edit="${p.id}">Modifica</button>
            <button class="btn btn--ghost btn--sm" data-del="${p.id}" style="color:var(--err)">Elimina</button>
          </td>
        </tr>`).join('')}</tbody>`;

    t.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
      const p = state.products.find((x) => x.id === Number(b.dataset.toggle));
      try { await API.put(`/api/products/${p.id}`, { available: !p.available }); loadProducts(); }
      catch (e) { toast(e.message, 'error'); }
    }));
    t.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => openProductModal(state.products.find((x) => x.id === Number(b.dataset.edit)))));
    t.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const p = state.products.find((x) => x.id === Number(b.dataset.del));
      if (!confirm(`Eliminare "${p.name}" dal menu?`)) return;
      try { await API.del(`/api/products/${p.id}`); toast('Prodotto eliminato.', 'info'); loadProducts(); }
      catch (e) { toast(e.message, 'error'); }
    }));
  }

  let galleryImages = [];
  let dragIdx = -1;

  function renderGallery() {
    const list = document.getElementById('pzGalleryList');
    const label = document.getElementById('pzGalleryLabel');
    if (!list) return;
    if (label) label.style.display = galleryImages.length > 0 ? '' : 'none';
    list.innerHTML = galleryImages.map((url, i) =>
      '<div class="gallery-thumb' + (i === 0 ? ' is-cover' : '') + '" draggable="true" data-idx="' + i + '">' +
        '<img src="' + url + '" alt="" loading="lazy" onerror="this.style.opacity=\'.3\'" />' +
        (i === 0 ? '<span class="gallery-thumb__badge">Copertina</span>' : '<span class="gallery-thumb__remove" data-idx="' + i + '" draggable="false">&times;</span>') +
      '</div>'
    ).join('');
    window._galleryRef = galleryImages;
  }

  function setupGalleryDelegation() {
    const list = document.getElementById('pzGalleryList');
    if (!list || list.dataset.galleryInit) return;
    list.dataset.galleryInit = '1';

    list.addEventListener('click', function(e) {
      const rm = e.target.closest('.gallery-thumb__remove');
      if (!rm) return;
      e.stopPropagation();
      const idx = Number(rm.dataset.idx);
      galleryImages.splice(idx, 1);
      renderGallery();
    });

    list.addEventListener('dragstart', function(e) {
      const thumb = e.target.closest('.gallery-thumb');
      if (!thumb) return;
      dragIdx = Number(thumb.dataset.idx);
      e.dataTransfer.setData('text/plain', dragIdx);
      e.dataTransfer.effectAllowed = 'move';
      thumb.style.opacity = '.5';
    });

    list.addEventListener('dragend', function(e) {
      dragIdx = -1;
      list.querySelectorAll('.gallery-thumb').forEach(function(t) { t.style.opacity = '1'; });
      list.querySelectorAll('.drag-over').forEach(function(t) { t.classList.remove('drag-over'); });
    });

    list.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    list.addEventListener('dragenter', function(e) {
      const thumb = e.target.closest('.gallery-thumb');
      if (thumb) thumb.classList.add('drag-over');
    });

    list.addEventListener('dragleave', function(e) {
      const thumb = e.target.closest('.gallery-thumb');
      if (thumb) thumb.classList.remove('drag-over');
    });

    list.addEventListener('drop', function(e) {
      e.preventDefault();
      const thumb = e.target.closest('.gallery-thumb');
      list.querySelectorAll('.drag-over').forEach(function(t) { t.classList.remove('drag-over'); });
      if (!thumb || dragIdx < 0) return;
      const to = Number(thumb.dataset.idx);
      if (dragIdx !== to) {
        var item = galleryImages.splice(dragIdx, 1)[0];
        galleryImages.splice(to, 0, item);
        renderGallery();
      }
    });
  }

  function handleImageFiles() {
    const input = document.getElementById('pzImageFile');
    if (!input.files || input.files.length === 0) return;
    const files = Array.from(input.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) { input.value = ''; return; }
    let loaded = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = function() {
        galleryImages.push(reader.result);
        loaded++;
        if (loaded >= files.length) { input.value = ''; renderGallery(); }
      };
      reader.readAsDataURL(file);
    });
  }

  function openProductModal(product) {
    const modal = document.getElementById('pizzaModalOverlay');
    document.getElementById('pizzaError').textContent = '';
    document.getElementById('pizzaModalTitle').textContent = product ? 'Modifica prodotto' : 'Nuovo prodotto';
    document.getElementById('pzId').value = product ? product.id : '';
    document.getElementById('pzName').value = product ? product.name : '';
    document.getElementById('pzDesc').value = product ? product.description : '';
    document.getElementById('pzPrice').value = product ? (product.price / 100).toFixed(2) : '';
    document.getElementById('pzCat').value = product ? product.category : 'pani';
    document.getElementById('pzQuantity').value = product ? (product.quantity ?? 0) : 0;
    document.getElementById('pzAvail').checked = product ? !!product.available : true;
    try {
      galleryImages = product && product.images ? JSON.parse(product.images) : (product && product.image ? [product.image] : []);
    } catch { galleryImages = product && product.image ? [product.image] : []; }
    renderGallery();
    modal.classList.add('is-open');
  }
  function closeProductModal() { document.getElementById('pizzaModalOverlay').classList.remove('is-open'); }

  async function saveProduct() {
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
      description: document.getElementById('pzDesc').value.trim(),
      price: Math.round(euros * 100),
      category: document.getElementById('pzCat').value,
      quantity: parseInt(document.getElementById('pzQuantity').value) || 0,
      images: galleryImages,
      available: document.getElementById('pzAvail').checked,
    };
    try {
      if (id) await API.put(`/api/products/${id}`, payload);
      else await API.post('/api/products', payload);
      toast('Menu aggiornato.', 'success');
      closeProductModal();
      loadProducts();
    } catch (e) { document.getElementById('pizzaError').textContent = e.message; }
  }

  function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.admin-tabs button').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.tab === tab));
    document.getElementById('tabOrders').style.display = tab === 'orders' ? '' : 'none';
    document.getElementById('tabMenu').style.display = tab === 'menu' ? '' : 'none';
    if (tab === 'menu') loadProducts();
    if (tab === 'orders') loadOrders();
  }

  function startPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
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

  function init() {
    document.getElementById('adminLoginForm').addEventListener('submit', adminLogin);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.querySelectorAll('.admin-tabs button').forEach((b) =>
      b.addEventListener('click', () => switchTab(b.dataset.tab)));
    document.getElementById('addPizzaBtn').addEventListener('click', () => openProductModal(null));
    document.getElementById('closePizzaModal').addEventListener('click', closeProductModal);
    document.getElementById('savePizzaBtn').addEventListener('click', saveProduct);
    document.getElementById('pizzaModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'pizzaModalOverlay') closeProductModal();
    });
    const fileInput = document.getElementById('pzImageFile');
    if (fileInput) fileInput.addEventListener('change', handleImageFiles);
    setupGalleryDelegation();

    const notifBtn = document.getElementById('enableNotif');
    if (notifBtn) {
      const bellSvg = '<svg class="ic" viewBox="0 0 24 24" style="width:1em;height:1em;vertical-align:-.15em"><path d="M18 12.5V10a6 6 0 1 0-12 0v2.5l-2 3V17h16v-1.5l-2-3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 17.5a2.5 2.5 0 0 0 5 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      const refreshNotifBtn = () => {
        if (!('Notification' in window)) { notifBtn.style.display = 'none'; return; }
        if (Notification.permission === 'granted') { notifBtn.innerHTML = bellSvg + ' Notifiche attive'; notifBtn.disabled = true; }
        else if (Notification.permission === 'denied') { notifBtn.innerHTML = bellSvg + ' Notifiche bloccate'; notifBtn.disabled = true; }
        else { notifBtn.innerHTML = bellSvg + ' Attiva notifiche'; notifBtn.disabled = false; }
      };
      notifBtn.addEventListener('click', () => {
        if (!('Notification' in window)) return;
        Notification.requestPermission().then(() => {
          refreshNotifBtn();
          if (Notification.permission === 'granted') {
            desktopNotify('Notifiche attive \u2713', 'Riceverai un avviso ad ogni nuovo ordine.');
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
