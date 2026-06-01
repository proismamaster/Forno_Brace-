// Logica del sito lato cliente: menu, carrello, checkout, pagamento, ordini, account.
(function () {
  'use strict';

  const state = {
    pizzas: [],
    cart: loadCart(),
    category: 'tutte',
    search: '',
    config: { deliveryFee: 0, freeDeliveryOver: 0 },
    paymentMethod: 'contanti',
    pendingCheckout: false,
    lastOrder: null,
  };

  // ── Carrello (persistito in localStorage) ─────────────────────────────────
  function loadCart() { try { return JSON.parse(localStorage.getItem('pizza_cart')) || []; } catch { return []; } }
  function saveCart() { localStorage.setItem('pizza_cart', JSON.stringify(state.cart)); }
  const cartCount = () => state.cart.reduce((n, i) => n + i.quantity, 0);
  const cartSubtotal = () => state.cart.reduce((n, i) => n + i.price * i.quantity, 0);
  function deliveryFee() {
    const sub = cartSubtotal();
    if (sub === 0) return 0;
    if (state.config.freeDeliveryOver > 0 && sub >= state.config.freeDeliveryOver) return 0;
    return state.config.deliveryFee;
  }
  const cartTotal = () => cartSubtotal() + deliveryFee();

  function addToCart(pizza) {
    const found = state.cart.find((i) => i.pizza_id === pizza.id);
    if (found) found.quantity = Math.min(20, found.quantity + 1);
    else state.cart.push({ pizza_id: pizza.id, name: pizza.name, emoji: pizza.emoji, price: pizza.price, quantity: 1 });
    saveCart(); refreshCartUI(); renderGrid();
    toast(`${pizza.emoji} ${pizza.name} aggiunta`, 'success');
  }
  function changeQty(pizzaId, delta) {
    const item = state.cart.find((i) => i.pizza_id === pizzaId);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) state.cart = state.cart.filter((i) => i.pizza_id !== pizzaId);
    else item.quantity = Math.min(20, item.quantity);
    saveCart(); refreshCartUI(); renderGrid();
    if (currentView() === 'checkout') renderCheckoutSummary();
  }
  function removeFromCart(pizzaId) {
    state.cart = state.cart.filter((i) => i.pizza_id !== pizzaId);
    saveCart(); refreshCartUI(); renderGrid();
  }
  function clearCart() { state.cart = []; saveCart(); refreshCartUI(); renderGrid(); }

  function refreshCartUI() {
    const badge = document.getElementById('cartBadge');
    const n = cartCount();
    badge.textContent = n;
    badge.classList.toggle('hidden', n === 0);
    renderCartDrawer();
  }

  // ── Router minimale ───────────────────────────────────────────────────────
  function currentView() {
    const v = document.querySelector('.view:not(.hidden)');
    return v ? v.dataset.view : 'menu';
  }
  function showView(name) {
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('hidden', v.dataset.view !== name));
    document.querySelectorAll('[data-nav]').forEach((el) =>
      el.classList.toggle('is-active', el.dataset.nav === name));
    document.querySelectorAll('.mobile-nav button[data-nav]').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.nav === name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (name === 'orders') loadOrders();
    if (name === 'account') renderAccount();
    if (name === 'checkout') renderCheckoutSummary();
  }

  // ── Autenticazione UI ─────────────────────────────────────────────────────
  function updateAuthUI() {
    const user = currentUser();
    const nav = document.getElementById('navAccount');
    nav.textContent = user ? `👤 ${user.name.split(' ')[0]}` : 'Accedi';
  }

  // ── Menu ──────────────────────────────────────────────────────────────────
  const CAT_LABEL = (c) => c.charAt(0).toUpperCase() + c.slice(1);

  function renderPills() {
    const cats = ['tutte', ...Array.from(new Set(state.pizzas.map((p) => p.category)))];
    const wrap = document.getElementById('categoryPills');
    wrap.innerHTML = cats.map((c) =>
      `<button class="pill ${c === state.category ? 'is-active' : ''}" data-cat="${c}">${CAT_LABEL(c)}</button>`
    ).join('');
    wrap.querySelectorAll('.pill').forEach((b) => b.addEventListener('click', () => {
      state.category = b.dataset.cat; renderPills(); renderGrid();
    }));
  }

  function renderGrid() {
    const grid = document.getElementById('pizzaGrid');
    const term = state.search.trim().toLowerCase();
    let list = state.pizzas;
    if (state.category !== 'tutte') list = list.filter((p) => p.category === state.category);
    if (term) list = list.filter((p) =>
      p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term));

    if (list.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="big">😕</span>Nessuna pizza trovata.</div>`;
      return;
    }
    grid.innerHTML = list.map((p) => {
      const inCart = state.cart.find((i) => i.pizza_id === p.id);
      const control = inCart
        ? `<div class="stepper" data-id="${p.id}">
             <button data-act="dec" aria-label="Togli">−</button>
             <span>${inCart.quantity}</span>
             <button data-act="inc" aria-label="Aggiungi">+</button>
           </div>`
        : `<button class="btn btn--primary btn--sm" data-add="${p.id}">Aggiungi</button>`;
      return `<article class="pizza-card ${p.available ? '' : 'is-unavailable'}">
        <span class="pizza-card__cat">${escapeHtml(p.category)}</span>
        <span class="pizza-card__emoji">${p.emoji}</span>
        <h3>${escapeHtml(p.name)}</h3>
        <p class="pizza-card__desc">${escapeHtml(p.description)}</p>
        <div class="pizza-card__foot">
          <span class="price">${euro(p.price)}</span>
          ${p.available ? control : '<span class="muted">Esaurita</span>'}
        </div>
      </article>`;
    }).join('');

    grid.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
      const p = state.pizzas.find((x) => x.id === Number(b.dataset.add));
      if (p) addToCart(p);
    }));
    grid.querySelectorAll('.stepper').forEach((s) => {
      const id = Number(s.dataset.id);
      s.querySelector('[data-act="inc"]').addEventListener('click', () => changeQty(id, +1));
      s.querySelector('[data-act="dec"]').addEventListener('click', () => changeQty(id, -1));
    });
  }

  // ── Drawer carrello ───────────────────────────────────────────────────────
  function openCart() {
    document.getElementById('overlay').classList.add('is-open');
    document.getElementById('cartDrawer').classList.add('is-open');
  }
  function closeCart() {
    document.getElementById('overlay').classList.remove('is-open');
    document.getElementById('cartDrawer').classList.remove('is-open');
  }

  function renderCartDrawer() {
    const body = document.getElementById('cartBody');
    const foot = document.getElementById('cartFoot');
    if (state.cart.length === 0) {
      body.innerHTML = `<div class="empty-state"><span class="big">🛒</span>Il carrello è vuoto.<br />Aggiungi qualche pizza!</div>`;
      foot.innerHTML = `<button class="btn btn--ghost btn--block" id="goMenuFromCart">Vai al menu</button>`;
      foot.querySelector('#goMenuFromCart').addEventListener('click', () => { closeCart(); showView('menu'); });
      return;
    }
    body.innerHTML = state.cart.map((i) => `
      <div class="cart-line">
        <span class="cart-line__emoji">${i.emoji}</span>
        <div class="cart-line__main">
          <strong>${escapeHtml(i.name)}</strong>
          <small>${euro(i.price)} · ${euro(i.price * i.quantity)}</small>
          <div><button class="cart-line__remove" data-rm="${i.pizza_id}">Rimuovi</button></div>
        </div>
        <div class="stepper" data-id="${i.pizza_id}">
          <button data-act="dec">−</button><span>${i.quantity}</span><button data-act="inc">+</button>
        </div>
      </div>`).join('');

    const sub = cartSubtotal(), fee = deliveryFee();
    foot.innerHTML = `
      <div class="summary-row"><span>Subtotale</span><span>${euro(sub)}</span></div>
      <div class="summary-row"><span>Consegna</span><span>${fee === 0 ? 'Gratis' : euro(fee)}</span></div>
      <div class="summary-row total"><span>Totale</span><span class="price">${euro(cartTotal())}</span></div>
      <button class="btn btn--primary btn--block btn--lg" id="checkoutBtn" style="margin-top:.8rem">Procedi all'ordine</button>
      <button class="btn btn--ghost btn--block btn--sm" id="clearCartBtn" style="margin-top:.5rem">Svuota carrello</button>`;

    body.querySelectorAll('.stepper').forEach((s) => {
      const id = Number(s.dataset.id);
      s.querySelector('[data-act="inc"]').addEventListener('click', () => changeQty(id, +1));
      s.querySelector('[data-act="dec"]').addEventListener('click', () => changeQty(id, -1));
    });
    body.querySelectorAll('[data-rm]').forEach((b) =>
      b.addEventListener('click', () => removeFromCart(Number(b.dataset.rm))));
    foot.querySelector('#checkoutBtn').addEventListener('click', goCheckout);
    foot.querySelector('#clearCartBtn').addEventListener('click', clearCart);
  }

  // ── Checkout ──────────────────────────────────────────────────────────────
  function goCheckout() {
    if (state.cart.length === 0) { toast('Il carrello è vuoto.', 'error'); return; }
    closeCart();
    if (!currentUser()) {
      state.pendingCheckout = true;
      toast('Accedi o registrati per completare l\'ordine.', 'info');
      showView('account');
      return;
    }
    // Precompila i dati dal profilo.
    const u = currentUser();
    document.getElementById('dName').value = document.getElementById('dName').value || u.name || '';
    document.getElementById('dAddr').value = document.getElementById('dAddr').value || u.address || '';
    document.getElementById('dPhone').value = document.getElementById('dPhone').value || u.phone || '';
    showView('checkout');
  }

  function renderCheckoutSummary() {
    const box = document.getElementById('checkoutSummary');
    if (state.cart.length === 0) {
      box.innerHTML = `<div class="empty-state"><span class="big">🛒</span>Carrello vuoto.<br/>
        <button class="btn btn--primary" id="backToMenu" style="margin-top:1rem">Torna al menu</button></div>`;
      box.querySelector('#backToMenu').addEventListener('click', () => showView('menu'));
      return;
    }
    const sub = cartSubtotal(), fee = deliveryFee();
    box.innerHTML = `
      <h3 style="margin-bottom:1rem">Riepilogo</h3>
      ${state.cart.map((i) => `<div class="summary-row"><span>${i.quantity}× ${escapeHtml(i.name)}</span><span>${euro(i.price * i.quantity)}</span></div>`).join('')}
      <div class="summary-row" style="margin-top:.6rem"><span>Subtotale</span><span>${euro(sub)}</span></div>
      <div class="summary-row"><span>Consegna</span><span>${fee === 0 ? 'Gratis' : euro(fee)}</span></div>
      <div class="summary-row total"><span>Totale</span><span class="price">${euro(cartTotal())}</span></div>
      <button class="btn btn--green btn--block btn--lg" id="placeOrderBtn" style="margin-top:1rem">
        ${state.paymentMethod === 'carta' ? '💳 Paga ' + euro(cartTotal()) : '✅ Conferma ordine'}
      </button>
      <button class="btn btn--ghost btn--block btn--sm" id="backMenuBtn" style="margin-top:.5rem">← Aggiungi altro</button>`;
    box.querySelector('#placeOrderBtn').addEventListener('click', placeOrder);
    box.querySelector('#backMenuBtn').addEventListener('click', () => showView('menu'));
  }

  function gatherDelivery() {
    const name = document.getElementById('dName').value.trim();
    const address = document.getElementById('dAddr').value.trim();
    const phone = document.getElementById('dPhone').value.trim();
    const notes = document.getElementById('dNotes').value.trim();
    return { name, address, phone, notes };
  }

  function placeOrder() {
    const d = gatherDelivery();
    if (!d.name || !d.address || !d.phone) {
      toast('Compila nome, indirizzo e telefono.', 'error');
      return;
    }
    if (state.paymentMethod === 'carta') {
      openPayModal();
    } else {
      submitOrder(null);
    }
  }

  async function submitOrder(card) {
    const d = gatherDelivery();
    const payload = {
      items: state.cart.map((i) => ({ pizza_id: i.pizza_id, quantity: i.quantity })),
      payment_method: state.paymentMethod,
      card,
      delivery: { name: d.name, address: d.address, phone: d.phone },
      notes: d.notes,
    };
    const data = await API.post('/api/orders', payload); // può lanciare
    state.lastOrder = data.order;
    clearCart();
    return data.order;
  }

  // ── Modale pagamento carta ────────────────────────────────────────────────
  function openPayModal() {
    document.getElementById('payError').textContent = '';
    document.getElementById('payNowBtn').innerHTML = `💳 Paga ${euro(cartTotal())}`;
    const u = currentUser();
    if (u && !document.getElementById('ccName').value) document.getElementById('ccName').value = u.name || '';
    updateCardPreview();
    document.getElementById('payModalOverlay').classList.add('is-open');
  }
  function closePayModal() { document.getElementById('payModalOverlay').classList.remove('is-open'); }

  function updateCardPreview() {
    const num = document.getElementById('ccNumber').value || '';
    document.getElementById('ccPreview').textContent = num.trim() || '•••• •••• •••• ••••';
    document.getElementById('ccNamePreview').textContent =
      (document.getElementById('ccName').value || 'NOME COGNOME').toUpperCase();
    document.getElementById('ccExpPreview').textContent = document.getElementById('ccExp').value || 'MM/AA';
  }

  function setupCardInputs() {
    const num = document.getElementById('ccNumber');
    const exp = document.getElementById('ccExp');
    const cvc = document.getElementById('ccCvc');
    const name = document.getElementById('ccName');

    num.addEventListener('input', () => {
      let v = num.value.replace(/\D/g, '').slice(0, 19);
      num.value = v.replace(/(.{4})/g, '$1 ').trim();
      updateCardPreview();
    });
    exp.addEventListener('input', () => {
      let v = exp.value.replace(/\D/g, '').slice(0, 4);
      if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
      exp.value = v;
      updateCardPreview();
    });
    cvc.addEventListener('input', () => { cvc.value = cvc.value.replace(/\D/g, '').slice(0, 4); });
    name.addEventListener('input', updateCardPreview);

    document.querySelectorAll('.test-cards code[data-card]').forEach((c) =>
      c.addEventListener('click', () => {
        num.value = c.dataset.card; exp.value = '12/27'; cvc.value = '123';
        if (!name.value) name.value = (currentUser()?.name) || 'Mario Rossi';
        updateCardPreview();
      }));

    document.getElementById('closePayModal').addEventListener('click', closePayModal);
    document.getElementById('payModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'payModalOverlay') closePayModal();
    });
    document.getElementById('payNowBtn').addEventListener('click', payNow);
  }

  async function payNow() {
    const btn = document.getElementById('payNowBtn');
    const errEl = document.getElementById('payError');
    errEl.textContent = '';
    const card = {
      number: document.getElementById('ccNumber').value,
      exp: document.getElementById('ccExp').value,
      cvc: document.getElementById('ccCvc').value,
      name: document.getElementById('ccName').value,
    };
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Elaborazione…`;
    try {
      // Piccola pausa per simulare l'elaborazione del pagamento.
      await new Promise((r) => setTimeout(r, 900));
      const order = await submitOrder(card);
      closePayModal();
      renderConfirm(order);
      showView('confirm');
    } catch (e) {
      errEl.textContent = e.message || 'Pagamento non riuscito.';
      btn.disabled = false;
      btn.innerHTML = `💳 Paga ${euro(cartTotal())}`;
    }
  }

  // ── Conferma ordine ───────────────────────────────────────────────────────
  function renderConfirm(order) {
    const paidLabel = order.payment_method === 'carta'
      ? '<span class="badge badge--pagato">Pagato con carta</span>'
      : '<span class="badge badge--contanti">Da pagare alla consegna</span>';
    document.getElementById('confirmBox').innerHTML = `
      <div class="confirm__check">✓</div>
      <h2 style="font-size:1.7rem">Ordine confermato!</h2>
      <p class="muted">Il tuo ordine <strong>#${order.id}</strong> è stato inviato alla pizzeria.</p>
      <p style="margin:.8rem 0">${paidLabel}</p>
      <div class="panel" style="max-width:420px;margin:1.2rem auto;text-align:left">
        ${order.items.map((i) => `<div class="summary-row"><span>${i.quantity}× ${escapeHtml(i.pizza_name)}</span><span>${euro(i.unit_price * i.quantity)}</span></div>`).join('')}
        <div class="summary-row"><span>Consegna</span><span>${order.delivery_fee === 0 ? 'Gratis' : euro(order.delivery_fee)}</span></div>
        <div class="summary-row total"><span>Totale</span><span class="price">${euro(order.total)}</span></div>
      </div>
      <div style="display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap">
        <button class="btn btn--primary" id="seeOrders">📦 I miei ordini</button>
        <button class="btn btn--ghost" id="backHome">Torna al menu</button>
      </div>`;
    document.getElementById('seeOrders').addEventListener('click', () => showView('orders'));
    document.getElementById('backHome').addEventListener('click', () => showView('menu'));
    // Reset campi checkout per il prossimo ordine.
    ['dNotes'].forEach((id) => (document.getElementById(id).value = ''));
    ['ccNumber', 'ccExp', 'ccCvc'].forEach((id) => (document.getElementById(id).value = ''));
  }

  // ── I miei ordini ─────────────────────────────────────────────────────────
  function timelineHtml(status) {
    if (status === 'annullato') return `<p style="margin-top:.6rem"><span class="badge badge--annullato">Ordine annullato</span></p>`;
    const idx = STATUS_FLOW.indexOf(status);
    return `<div class="timeline">${STATUS_FLOW.map((s, i) => {
      const cls = i < idx ? 'done' : i === idx ? 'current done' : '';
      const icon = i < idx ? '✓' : (i + 1);
      return `<div class="timeline__step ${cls}"><div class="timeline__dot">${icon}</div>${STATUS_LABELS[s]}</div>`;
    }).join('')}</div>`;
  }

  async function loadOrders() {
    const list = document.getElementById('ordersList');
    if (!currentUser()) {
      list.innerHTML = `<div class="empty-state"><span class="big">🔒</span>Accedi per vedere i tuoi ordini.<br/>
        <button class="btn btn--primary" id="goLogin" style="margin-top:1rem">Accedi</button></div>`;
      list.querySelector('#goLogin').addEventListener('click', () => showView('account'));
      return;
    }
    list.innerHTML = `<div class="empty-state">Caricamento…</div>`;
    try {
      const { orders } = await API.get('/api/orders/mine');
      if (orders.length === 0) {
        list.innerHTML = `<div class="empty-state"><span class="big">📦</span>Non hai ancora ordinato nulla.<br/>
          <button class="btn btn--primary" id="goMenu2" style="margin-top:1rem">Vai al menu</button></div>`;
        list.querySelector('#goMenu2').addEventListener('click', () => showView('menu'));
        return;
      }
      list.innerHTML = orders.map((o) => `
        <div class="order-card">
          <div class="order-card__head">
            <span class="order-card__id">Ordine #${o.id}</span>
            <div style="display:flex;gap:.4rem;flex-wrap:wrap">
              <span class="badge badge--${o.status}">${STATUS_LABELS[o.status]}</span>
              <span class="badge badge--${o.payment_method}">${o.payment_method === 'carta' ? '💳 Carta' : '💶 Contanti'}</span>
              <span class="badge badge--${o.payment_status}">${PAYMENT_LABELS[o.payment_status]}</span>
            </div>
          </div>
          <small class="muted">${formatDate(o.created_at)} · consegna a ${escapeHtml(o.delivery_address)}</small>
          <ul class="order-items-list">
            ${o.items.map((i) => `<li><span>${i.quantity}× ${escapeHtml(i.pizza_name)}</span><span>${euro(i.unit_price * i.quantity)}</span></li>`).join('')}
            <li style="font-weight:700;color:var(--ink);border-top:1px solid var(--line);padding-top:.4rem;margin-top:.2rem"><span>Totale</span><span>${euro(o.total)}</span></li>
          </ul>
          ${timelineHtml(o.status)}
        </div>`).join('');
    } catch (e) {
      list.innerHTML = `<div class="empty-state">Errore nel caricamento.</div>`;
      toast(e.message, 'error');
    }
  }

  // ── Account: login / registrazione / profilo ──────────────────────────────
  function renderAccount() {
    const area = document.getElementById('accountArea');
    const user = currentUser();
    if (user) {
      area.innerHTML = `
        <div class="panel">
          <h2 style="margin-bottom:.3rem">Ciao, ${escapeHtml(user.name)} 👋</h2>
          <p class="muted" style="margin-bottom:1.2rem">${escapeHtml(user.email)}</p>
          <div class="field"><label>Nome</label><input id="pfName" value="${escapeHtml(user.name)}" /></div>
          <div class="field"><label>Indirizzo predefinito</label><input id="pfAddr" value="${escapeHtml(user.address || '')}" placeholder="Via, civico, città" /></div>
          <div class="field"><label>Telefono</label><input id="pfPhone" value="${escapeHtml(user.phone || '')}" placeholder="Numero di telefono" /></div>
          <button class="btn btn--primary" id="saveProfile">Salva modifiche</button>
          <button class="btn btn--ghost" id="logoutBtn" style="margin-left:.5rem">Esci</button>
          <hr style="border:0;border-top:1px solid var(--line);margin:1.4rem 0" />
          <button class="btn btn--green btn--block" id="goOrders">📦 Vedi i miei ordini</button>
        </div>`;
      area.querySelector('#saveProfile').addEventListener('click', saveProfile);
      area.querySelector('#logoutBtn').addEventListener('click', logout);
      area.querySelector('#goOrders').addEventListener('click', () => showView('orders'));
      return;
    }
    area.innerHTML = `
      <div class="panel">
        <div class="tabs">
          <button class="is-active" data-tab="login">Accedi</button>
          <button data-tab="register">Registrati</button>
        </div>
        <form id="loginForm">
          <div class="field"><label>Email</label><input type="email" id="liEmail" placeholder="tu@email.it" required /></div>
          <div class="field"><label>Password</label><input type="password" id="liPass" placeholder="••••••" required /></div>
          <button class="btn btn--primary btn--block btn--lg" type="submit">Accedi</button>
          <p class="muted" style="font-size:.8rem;margin-top:.8rem;text-align:center">Demo: mario@example.com / mario123</p>
        </form>
        <form id="registerForm" class="hidden">
          <div class="field"><label>Nome e cognome</label><input id="rgName" placeholder="Mario Rossi" required /></div>
          <div class="field"><label>Email</label><input type="email" id="rgEmail" placeholder="tu@email.it" required /></div>
          <div class="field"><label>Password</label><input type="password" id="rgPass" placeholder="almeno 6 caratteri" required /></div>
          <div class="field"><label>Indirizzo (facoltativo)</label><input id="rgAddr" placeholder="Via, civico, città" /></div>
          <div class="field"><label>Telefono (facoltativo)</label><input id="rgPhone" placeholder="Numero di telefono" /></div>
          <button class="btn btn--primary btn--block btn--lg" type="submit">Crea account</button>
        </form>
      </div>`;

    const tabs = area.querySelectorAll('.tabs button');
    tabs.forEach((t) => t.addEventListener('click', () => {
      tabs.forEach((x) => x.classList.toggle('is-active', x === t));
      area.querySelector('#loginForm').classList.toggle('hidden', t.dataset.tab !== 'login');
      area.querySelector('#registerForm').classList.toggle('hidden', t.dataset.tab !== 'register');
    }));
    area.querySelector('#loginForm').addEventListener('submit', doLogin);
    area.querySelector('#registerForm').addEventListener('submit', doRegister);
  }

  async function doLogin(e) {
    e.preventDefault();
    try {
      const data = await API.post('/api/auth/login', {
        email: document.getElementById('liEmail').value,
        password: document.getElementById('liPass').value,
      });
      setAuth(data.token, data.user);
      updateAuthUI();
      toast(`Bentornato, ${data.user.name.split(' ')[0]}!`, 'success');
      afterAuth();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function doRegister(e) {
    e.preventDefault();
    try {
      const data = await API.post('/api/auth/register', {
        name: document.getElementById('rgName').value,
        email: document.getElementById('rgEmail').value,
        password: document.getElementById('rgPass').value,
        address: document.getElementById('rgAddr').value,
        phone: document.getElementById('rgPhone').value,
      });
      setAuth(data.token, data.user);
      updateAuthUI();
      toast('Account creato. Benvenuto!', 'success');
      afterAuth();
    } catch (err) { toast(err.message, 'error'); }
  }

  function afterAuth() {
    if (state.pendingCheckout && state.cart.length > 0) {
      state.pendingCheckout = false;
      goCheckout();
    } else {
      showView('menu');
    }
  }

  async function saveProfile() {
    try {
      const data = await API.put('/api/auth/me', {
        name: document.getElementById('pfName').value,
        address: document.getElementById('pfAddr').value,
        phone: document.getElementById('pfPhone').value,
      });
      const token = API.token();
      setAuth(token, data.user);
      updateAuthUI();
      toast('Profilo aggiornato.', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  function logout() {
    clearAuth(); updateAuthUI(); toast('Disconnesso.', 'info'); showView('menu');
  }

  // ── Verifica token all'avvio ──────────────────────────────────────────────
  async function refreshUser() {
    if (!API.token()) return;
    try {
      const { user } = await API.get('/api/auth/me');
      setAuth(API.token(), user);
    } catch (e) {
      if (e.status === 401) clearAuth();
    }
  }

  // ── Avvio ─────────────────────────────────────────────────────────────────
  async function init() {
    // Navigazione
    document.querySelectorAll('[data-nav]').forEach((el) =>
      el.addEventListener('click', (e) => { e.preventDefault(); showView(el.dataset.nav); }));
    document.getElementById('cartBtn').addEventListener('click', openCart);
    document.getElementById('mCartBtn').addEventListener('click', openCart);
    document.getElementById('closeCart').addEventListener('click', closeCart);
    document.getElementById('overlay').addEventListener('click', closeCart);
    document.getElementById('searchInput').addEventListener('input', (e) => {
      state.search = e.target.value; renderGrid();
    });

    // Metodi di pagamento
    document.querySelectorAll('.pay-option').forEach((opt) =>
      opt.addEventListener('click', () => {
        document.querySelectorAll('.pay-option').forEach((o) => o.classList.remove('is-active'));
        opt.classList.add('is-active');
        opt.querySelector('input').checked = true;
        state.paymentMethod = opt.dataset.method;
        if (currentView() === 'checkout') renderCheckoutSummary();
      }));

    setupCardInputs();
    updateAuthUI();

    // Carica configurazione + menu
    try {
      const [cfg, pizzasData] = await Promise.all([API.get('/api/config'), API.get('/api/pizzas')]);
      state.config = cfg;
      state.pizzas = pizzasData.pizzas;
    } catch (e) {
      toast('Impossibile caricare il menu. Riprova.', 'error');
    }
    renderPills();
    renderGrid();
    refreshCartUI();
    await refreshUser();
    updateAuthUI();
    showView('menu');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
