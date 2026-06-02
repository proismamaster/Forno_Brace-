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
    orderType: 'consegna',
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
    if (state.orderType !== 'consegna') return 0; // asporto e tavolo: nessun costo di consegna
    if (state.config.freeDeliveryOver > 0 && sub >= state.config.freeDeliveryOver) return 0;
    return state.config.deliveryFee;
  }
  const cartTotal = () => cartSubtotal() + deliveryFee();

  function addToCart(pizza) {
    const found = state.cart.find((i) => i.pizza_id === pizza.id);
    if (found) found.quantity = Math.min(20, found.quantity + 1);
    else state.cart.push({ pizza_id: pizza.id, name: pizza.name, emoji: pizza.emoji, image: pizza.image, price: pizza.price, quantity: 1 });
    saveCart(); refreshCartUI(); renderGrid();
    toast(`${pizza.name} aggiunto al carrello`, 'success');
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
  function showView(name, opts = {}) {
    const changed = currentView() !== name;
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('hidden', v.dataset.view !== name));
    document.querySelectorAll('[data-nav]').forEach((el) =>
      el.classList.toggle('is-active', el.dataset.nav === name));
    document.querySelectorAll('.mobile-nav button[data-nav]').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.nav === name));
    // Scorri in cima solo se cambiamo davvero vista (così lo scroll verso un'ancora non confligge).
    if (changed && !opts.noScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
    if (name === 'orders') loadOrders();
    if (name === 'account') renderAccount();
    if (name === 'checkout') renderCheckoutSummary();
  }

  // ── Autenticazione UI ─────────────────────────────────────────────────────
  function updateAuthUI() {
    const user = currentUser();
    const nav = document.getElementById('navAccount');
    nav.textContent = user ? user.name.split(' ')[0] : 'Accedi';
  }

  // ── Menu ──────────────────────────────────────────────────────────────────
  const ICON = (id) => `<svg class="ic"><use href="#${id}"/></svg>`;
  const CAT_ORDER = ['kebab', 'pizze', 'contorni'];
  const CAT_META = {
    kebab: { label: 'Kebab', icon: 'ic-kebab' },
    pizze: { label: 'Pizze', icon: 'ic-pizza' },
    contorni: { label: 'Sfizi', icon: 'ic-fries' },
  };
  const catLabel = (c) => (CAT_META[c] && CAT_META[c].label) || (c.charAt(0).toUpperCase() + c.slice(1));
  const catIcon = (c) => (CAT_META[c] && CAT_META[c].icon) || 'ic-menu';
  const catRank = (c) => { const i = CAT_ORDER.indexOf(c); return i === -1 ? 99 : i; };
  const ORDER_TYPE_META = {
    consegna: { label: 'Consegna', icon: 'ic-truck' },
    asporto: { label: 'Asporto', icon: 'ic-bag' },
    tavolo: { label: 'Al tavolo', icon: 'ic-table' },
  };
  const orderTypeChip = (t) => {
    const m = ORDER_TYPE_META[t] || ORDER_TYPE_META.consegna;
    return `${ICON(m.icon)} ${m.label}`;
  };

  function renderPills() {
    const present = Array.from(new Set(state.pizzas.map((p) => p.category)))
      .sort((a, b) => catRank(a) - catRank(b));
    const cats = ['tutte', ...present];
    const wrap = document.getElementById('categoryPills');
    wrap.innerHTML = cats.map((c) => {
      const inner = c === 'tutte' ? 'Tutto il menu' : `${ICON(catIcon(c))} ${catLabel(c)}`;
      return `<button class="pill ${c === state.category ? 'is-active' : ''}" data-cat="${c}">${inner}</button>`;
    }).join('');
    wrap.querySelectorAll('.pill').forEach((b) => b.addEventListener('click', () => {
      state.category = b.dataset.cat; renderPills(); renderGrid(true);
    }));
  }

  function renderGrid(animate = false) {
    const grid = document.getElementById('pizzaGrid');
    const term = state.search.trim().toLowerCase();
    let list = state.pizzas;
    if (state.category !== 'tutte') list = list.filter((p) => p.category === state.category);
    if (term) list = list.filter((p) =>
      p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term));

    if (list.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="big">${ICON('ic-search')}</span>Nessun prodotto trovato.</div>`;
      return;
    }
    grid.innerHTML = list.map((p, idx) => {
      const inCart = state.cart.find((i) => i.pizza_id === p.id);
      const control = inCart
        ? `<div class="stepper" data-id="${p.id}">
             <button data-act="dec" aria-label="Togli">−</button>
             <span>${inCart.quantity}</span>
             <button data-act="inc" aria-label="Aggiungi">+</button>
           </div>`
        : `<button class="btn btn--primary btn--sm" data-add="${p.id}">Aggiungi</button>`;
      const imgPath = (p.image && (p.image.startsWith('http') || p.image.startsWith('https')))
        ? p.image
        : (p.image ? `/images/${p.image}` : '');
      const img = imgPath
        ? `<img src="${escapeHtml(imgPath)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.remove()" />`
        : '';
      const popStyle = animate ? ` style="animation-delay:${Math.min(idx, 12) * 45}ms"` : '';
      return `<article class="pizza-card ${animate ? 'pop' : ''} ${p.available ? '' : 'is-unavailable'}"${popStyle}>
        <div class="pizza-card__media">
          <span class="pizza-card__cat">${ICON(catIcon(p.category))} ${catLabel(p.category)}</span>
          <span class="media-emoji">${p.emoji}</span>
          ${img}
          ${p.available ? '' : '<span class="sold-out">Esaurita</span>'}
        </div>
        <div class="pizza-card__body">
          <h3>${escapeHtml(p.name)}</h3>
          <p class="pizza-card__desc">${escapeHtml(p.description)}</p>
          <div class="pizza-card__foot">
            <span class="price">${euro(p.price)}</span>
            ${p.available ? control : ''}
          </div>
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
      body.innerHTML = `<div class="empty-state"><span class="big">${ICON('ic-cart')}</span>Il carrello è vuoto.<br />Aggiungi qualcosa dal menu!</div>`;
      foot.innerHTML = `<button class="btn btn--ghost btn--block" id="goMenuFromCart">Vai al menu</button>`;
      foot.querySelector('#goMenuFromCart').addEventListener('click', () => { closeCart(); showView('menu'); });
      return;
    }
    body.innerHTML = state.cart.map((i) => `
      <div class="cart-line">
        <span class="cart-line__emoji">${i.image
          ? `<img src="${i.image.startsWith('http') ? i.image : '/images/' + i.image}" alt="" loading="lazy" onerror="this.remove()" />`
          : (i.emoji || '')}</span>
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
      box.innerHTML = `<div class="empty-state"><span class="big">${ICON('ic-cart')}</span>Carrello vuoto.<br/>
        <button class="btn btn--primary" id="backToMenu" style="margin-top:1rem">Torna al menu</button></div>`;
      box.querySelector('#backToMenu').addEventListener('click', () => showView('menu'));
      return;
    }
    const sub = cartSubtotal(), fee = deliveryFee();
    const feeRow = state.orderType === 'consegna'
      ? `<div class="summary-row"><span>Consegna</span><span>${fee === 0 ? 'Gratis' : euro(fee)}</span></div>`
      : `<div class="summary-row"><span>Servizio</span><span>Gratis</span></div>`;
    box.innerHTML = `
      <h3 style="margin-bottom:1rem">Riepilogo</h3>
      <div class="summary-row" style="font-weight:600;color:var(--ink)"><span>Modalità</span><span>${orderTypeChip(state.orderType)}</span></div>
      <div style="border-top:1px dashed var(--line);margin:.6rem 0"></div>
      ${state.cart.map((i) => `<div class="summary-row"><span>${i.quantity}× ${escapeHtml(i.name)}</span><span>${euro(i.price * i.quantity)}</span></div>`).join('')}
      <div class="summary-row" style="margin-top:.6rem"><span>Subtotale</span><span>${euro(sub)}</span></div>
      ${feeRow}
      <div class="summary-row total"><span>Totale</span><span class="price">${euro(cartTotal())}</span></div>
      <button class="btn btn--green btn--block btn--lg" id="placeOrderBtn" style="margin-top:1rem">
        ${state.paymentMethod === 'carta' ? ICON('ic-card') + ' Paga ' + euro(cartTotal()) : ICON('ic-check') + ' Conferma ordine'}
      </button>
      <button class="btn btn--ghost btn--block btn--sm" id="backMenuBtn" style="margin-top:.5rem">← Aggiungi altro</button>`;
    box.querySelector('#placeOrderBtn').addEventListener('click', placeOrder);
    box.querySelector('#backMenuBtn').addEventListener('click', () => showView('menu'));
  }

  // Mostra/nasconde i campi del checkout in base al tipo di ordine.
  function setOrderType(type) {
    state.orderType = type;
    document.querySelectorAll('.order-type').forEach((o) =>
      o.classList.toggle('is-active', o.dataset.type === type));
    document.querySelectorAll('[data-for]').forEach((el) => {
      const types = el.dataset.for.split(' ');
      el.classList.toggle('hidden', !types.includes(type));
    });
    const lbl = document.getElementById('dTimeLabel');
    if (lbl) lbl.textContent = type === 'tavolo' ? 'Orario di arrivo' : 'Orario di ritiro';
    if (currentView() === 'checkout') renderCheckoutSummary();
  }

  function gatherDelivery() {
    return {
      name: document.getElementById('dName').value.trim(),
      address: document.getElementById('dAddr').value.trim(),
      phone: document.getElementById('dPhone').value.trim(),
      scheduled_time: document.getElementById('dTime').value.trim(),
      party_size: document.getElementById('dParty').value.trim(),
      notes: document.getElementById('dNotes').value.trim(),
    };
  }

  function placeOrder() {
    const d = gatherDelivery();
    if (!d.name) { toast('Inserisci il tuo nome.', 'error'); return; }
    if (state.orderType === 'consegna' && (!d.address || !d.phone)) {
      toast('Per la consegna servono indirizzo e telefono.', 'error'); return;
    }
    if (state.orderType === 'asporto' && !d.phone) {
      toast('Per l\'asporto serve un numero di telefono.', 'error'); return;
    }
    if (state.orderType === 'tavolo' && (!d.party_size || Number(d.party_size) < 1)) {
      toast('Indica per quante persone è il tavolo.', 'error'); return;
    }
    if (state.paymentMethod === 'carta') openPayModal();
    else submitOrder(null);
  }

  async function submitOrder(card) {
    const d = gatherDelivery();
    const payload = {
      items: state.cart.map((i) => ({ pizza_id: i.pizza_id, quantity: i.quantity })),
      payment_method: state.paymentMethod,
      order_type: state.orderType,
      card,
      delivery: {
        name: d.name, address: d.address, phone: d.phone,
        scheduled_time: d.scheduled_time, party_size: d.party_size,
      },
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
    document.getElementById('payNowBtn').innerHTML = `${ICON('ic-card')} Paga ${euro(cartTotal())}`;
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
      btn.innerHTML = `${ICON('ic-card')} Paga ${euro(cartTotal())}`;
    }
  }

  // ── Conferma ordine ───────────────────────────────────────────────────────
  function renderConfirm(order) {
    const payWhere = order.order_type === 'consegna' ? 'alla consegna' : 'al ritiro';
    const paidLabel = order.payment_method === 'carta'
      ? '<span class="badge badge--pagato">Pagato con carta</span>'
      : `<span class="badge badge--contanti">Da pagare ${payWhere}</span>`;
    let detail = '';
    if (order.order_type === 'consegna') detail = `${ICON('ic-pin')} Consegna a ${escapeHtml(order.delivery_address)}`;
    else if (order.order_type === 'asporto') detail = `${ICON('ic-bag')} Ritiro in negozio${order.scheduled_time ? ' alle ' + escapeHtml(order.scheduled_time) : ''}`;
    else detail = `${ICON('ic-table')} Tavolo per ${order.party_size}${order.scheduled_time ? ' · arrivo alle ' + escapeHtml(order.scheduled_time) : ''}`;
    const feeRow = order.delivery_fee > 0
      ? `<div class="summary-row"><span>Consegna</span><span>${euro(order.delivery_fee)}</span></div>` : '';
    document.getElementById('confirmBox').innerHTML = `
      <div class="confirm__check">${ICON('ic-check')}</div>
      <h2 style="font-size:1.7rem">Ordine confermato!</h2>
      <p class="muted">Ordine <strong>#${order.id}</strong> — ${orderTypeChip(order.order_type)}</p>
      <p class="muted" style="font-size:.92rem;margin-top:.2rem">${detail}</p>
      <p style="margin:.8rem 0">${paidLabel}</p>
      <div class="panel" style="max-width:420px;margin:1.2rem auto;text-align:left">
        ${order.items.map((i) => `<div class="summary-row"><span>${i.quantity}× ${escapeHtml(i.pizza_name)}</span><span>${euro(i.unit_price * i.quantity)}</span></div>`).join('')}
        ${feeRow}
        <div class="summary-row total"><span>Totale</span><span class="price">${euro(order.total)}</span></div>
      </div>
      <div style="display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap">
        <button class="btn btn--primary" id="seeOrders">${ICON('ic-package')} I miei ordini</button>
        <button class="btn btn--ghost" id="backHome">Torna al menu</button>
      </div>`;
    document.getElementById('seeOrders').addEventListener('click', () => showView('orders'));
    document.getElementById('backHome').addEventListener('click', () => showView('menu'));
    // Reset campi checkout per il prossimo ordine.
    ['dNotes'].forEach((id) => (document.getElementById(id).value = ''));
    ['ccNumber', 'ccExp', 'ccCvc'].forEach((id) => (document.getElementById(id).value = ''));
  }

  // ── I miei ordini ─────────────────────────────────────────────────────────
  function orderTypeBadge(o) {
    return `<span class="badge badge--type">${orderTypeChip(o.order_type)}</span>`;
  }
  function orderTypeLine(o) {
    if (o.order_type === 'asporto') return `Asporto${o.scheduled_time ? ' · ritiro alle ' + escapeHtml(o.scheduled_time) : ''}`;
    if (o.order_type === 'tavolo') return `Al tavolo per ${o.party_size}${o.scheduled_time ? ' · alle ' + escapeHtml(o.scheduled_time) : ''}`;
    return `Consegna a ${escapeHtml(o.delivery_address || '')}`;
  }

  function statusLabelFor(orderType, status) {
    if (orderType === 'asporto')
      return { ricevuto: 'Ricevuto', in_preparazione: 'In preparazione', in_consegna: 'Pronto', consegnato: 'Ritirato' }[status] || STATUS_LABELS[status];
    if (orderType === 'tavolo')
      return { ricevuto: 'Ricevuto', in_preparazione: 'In preparazione', in_consegna: 'Pronto', consegnato: 'Servito' }[status] || STATUS_LABELS[status];
    return STATUS_LABELS[status];
  }

  function timelineHtml(o) {
    if (o.status === 'annullato') return `<p style="margin-top:.6rem"><span class="badge badge--annullato">Ordine annullato</span></p>`;
    const idx = STATUS_FLOW.indexOf(o.status);
    return `<div class="timeline">${STATUS_FLOW.map((s, i) => {
      const cls = i < idx ? 'done' : i === idx ? 'current done' : '';
      const icon = i < idx ? '✓' : (i + 1);
      return `<div class="timeline__step ${cls}"><div class="timeline__dot">${icon}</div>${statusLabelFor(o.order_type, s)}</div>`;
    }).join('')}</div>`;
  }

  async function loadOrders() {
    const list = document.getElementById('ordersList');
    if (!currentUser()) {
      list.innerHTML = `<div class="empty-state"><span class="big">${ICON('ic-user')}</span>Accedi per vedere i tuoi ordini.<br/>
        <button class="btn btn--primary" id="goLogin" style="margin-top:1rem">Accedi</button></div>`;
      list.querySelector('#goLogin').addEventListener('click', () => showView('account'));
      return;
    }
    list.innerHTML = `<div class="empty-state">Caricamento…</div>`;
    try {
      const { orders } = await API.get('/api/orders/mine');
      if (orders.length === 0) {
        list.innerHTML = `<div class="empty-state"><span class="big">${ICON('ic-package')}</span>Non hai ancora ordinato nulla.<br/>
          <button class="btn btn--primary" id="goMenu2" style="margin-top:1rem">Vai al menu</button></div>`;
        list.querySelector('#goMenu2').addEventListener('click', () => showView('menu'));
        return;
      }
      list.innerHTML = orders.map((o) => `
        <div class="order-card">
          <div class="order-card__head">
            <span class="order-card__id">Ordine #${o.id}</span>
            <div style="display:flex;gap:.4rem;flex-wrap:wrap">
              ${orderTypeBadge(o)}
              <span class="badge badge--${o.status}">${statusLabelFor(o.order_type, o.status)}</span>
              <span class="badge badge--${o.payment_method}">${o.payment_method === 'carta' ? ICON('ic-card') + ' Carta' : ICON('ic-cash') + ' Contanti'}</span>
              <span class="badge badge--${o.payment_status}">${PAYMENT_LABELS[o.payment_status]}</span>
            </div>
          </div>
          <small class="muted">${formatDate(o.created_at)} · ${orderTypeLine(o)}</small>
          <ul class="order-items-list">
            ${o.items.map((i) => `<li><span>${i.quantity}× ${escapeHtml(i.pizza_name)}</span><span>${euro(i.unit_price * i.quantity)}</span></li>`).join('')}
            <li style="font-weight:700;color:var(--ink);border-top:1px solid var(--line);padding-top:.4rem;margin-top:.2rem"><span>Totale</span><span>${euro(o.total)}</span></li>
          </ul>
          ${timelineHtml(o)}
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
          <h2 style="margin-bottom:.3rem">Ciao, ${escapeHtml(user.name)}</h2>
          <p class="muted" style="margin-bottom:1.2rem">${escapeHtml(user.email)}</p>
          <div class="field"><label>Nome</label><input id="pfName" value="${escapeHtml(user.name)}" /></div>
          <div class="field"><label>Indirizzo predefinito</label><input id="pfAddr" value="${escapeHtml(user.address || '')}" placeholder="Via, civico, città" /></div>
          <div class="field"><label>Telefono</label><input id="pfPhone" value="${escapeHtml(user.phone || '')}" placeholder="Numero di telefono" /></div>
          <button class="btn btn--primary" id="saveProfile">Salva modifiche</button>
          <button class="btn btn--ghost" id="logoutBtn" style="margin-left:.5rem">Esci</button>
          <hr style="border:0;border-top:1px solid var(--line);margin:1.4rem 0" />
          <button class="btn btn--green btn--block" id="goOrders">${ICON('ic-package')} Vedi i miei ordini</button>
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
      state.search = e.target.value; renderGrid(true);
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

    // Tipo di ordine: consegna / asporto / tavolo
    document.querySelectorAll('.order-type').forEach((opt) =>
      opt.addEventListener('click', () => setOrderType(opt.dataset.type)));
    setOrderType('consegna');

    // Pulsanti/link che scorrono alle sezioni della homepage
    document.querySelectorAll('[data-scroll]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.preventDefault();
        showView('menu', { noScroll: true });
        requestAnimationFrame(() => {
          const el = document.getElementById(b.dataset.scroll);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }));

    setupCardInputs();
    updateAuthUI();

    // Carica configurazione + menu (con retry in caso di cold start)
    let retries = 3;
    while (retries > 0) {
      try {
        const [cfg, pizzasData] = await Promise.all([API.get('/api/config'), API.get('/api/pizzas')]);
        state.config = cfg;
        // Ordina per categoria (pizze, kebab, hamburger, contorni) e poi per nome.
        state.pizzas = pizzasData.pizzas.sort((a, b) =>
          catRank(a.category) - catRank(b.category) || a.name.localeCompare(b.name));
        console.log('✅ Menu caricato:', state.pizzas.length, 'prodotti');
        break;
      } catch (e) {
        retries--;
        console.error(`❌ Errore caricamento menu (${retries} tentativi rimasti):`, e);
        if (retries === 0) toast('Impossibile caricare il menu. Riprova ricaricando la pagina.', 'error');
        else await new Promise(r => setTimeout(r, 2000)); // Aspetta 2 secondi prima di riprovare
      }
    }

    renderPills();
    renderGrid(true);
    refreshCartUI();
    await refreshUser();
    updateAuthUI();
    showView('menu');
    setupAnimations();
  }

  // ── Animazioni: reveal allo scroll + header + mappa lazy ───────────────────
  function setupAnimations() {
    const header = document.querySelector('.site-header');
    if (header) {
      const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    // La mappa Google si carica solo quando ci si avvicina ai contatti (più veloce).
    const mapFrame = document.querySelector('.contact__map iframe[data-src]');
    const loadMap = () => { if (mapFrame && !mapFrame.src) mapFrame.src = mapFrame.dataset.src; };

    // Carica la mappa al primo scroll dell'utente (affidabile e leggero).
    const onceScrollMap = () => { loadMap(); window.removeEventListener('scroll', onceScrollMap); };
    window.addEventListener('scroll', onceScrollMap, { passive: true, once: true });

    const els = document.querySelectorAll('[data-reveal]');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasIO = 'IntersectionObserver' in window;
    const revealAll = () => els.forEach((e) => e.classList.add('revealed'));

    if (reduce || !hasIO) { revealAll(); loadMap(); return; }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('revealed'); io.unobserve(en.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    els.forEach((e) => io.observe(e));

    // Rete di sicurezza: se l'observer non scatta (ambienti particolari),
    // mostra comunque tutto dopo poco, così il contenuto non resta mai invisibile.
    setTimeout(revealAll, 1600);

    if (mapFrame) {
      const mapIo = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { loadMap(); mapIo.disconnect(); }
      }, { rootMargin: '400px' });
      mapIo.observe(mapFrame);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
