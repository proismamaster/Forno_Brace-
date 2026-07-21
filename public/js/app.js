(function () {
  'use strict';

  const state = {
    products: [],
    cart: loadCart(),
    category: 'tutte',
    search: '',
    config: { deliveryFee: 0, freeDeliveryOver: 0 },
    paymentMethod: 'contanti',
    orderType: 'consegna',
    pendingCheckout: false,
    lastOrder: null,
  };

  function loadCart() { try { return JSON.parse(localStorage.getItem('forno_cart')) || []; } catch { return []; } }
  function saveCart() { localStorage.setItem('forno_cart', JSON.stringify(state.cart)); }
  const cartCount = () => state.cart.reduce((n, i) => n + i.quantity, 0);
  const cartSubtotal = () => state.cart.reduce((n, i) => n + i.price * i.quantity, 0);
  function deliveryFee() {
    const sub = cartSubtotal();
    if (sub === 0) return 0;
    if (state.orderType !== 'consegna') return 0;
    if (state.config.freeDeliveryOver > 0 && sub >= state.config.freeDeliveryOver) return 0;
    return state.config.deliveryFee;
  }
  const cartTotal = () => cartSubtotal() + deliveryFee();

  function addToCart(product) {
    const found = state.cart.find((i) => i.product_id === product.id);
    if (found) found.quantity = Math.min(20, found.quantity + 1);
    else state.cart.push({ product_id: product.id, name: product.name, emoji: product.emoji, image: product.image, price: product.price, quantity: 1 });
    saveCart(); refreshCartUI(); renderGrid();
    toast(`${product.name} aggiunto al carrello`, 'success');
  }
  function changeQty(productId, delta) {
    const item = state.cart.find((i) => i.product_id === productId);
    if (!item) return;
    const product = state.products.find((p) => p.id === productId);
    const max = product ? product.quantity : 20;
    item.quantity += delta;
    if (item.quantity <= 0) state.cart = state.cart.filter((i) => i.product_id !== productId);
    else item.quantity = Math.min(max, item.quantity);
    saveCart(); refreshCartUI(); renderGrid();
    if (currentView() === 'checkout') renderCheckoutSummary();
  }
  function removeFromCart(productId) {
    state.cart = state.cart.filter((i) => i.product_id !== productId);
    saveCart(); refreshCartUI(); renderGrid();
  }
  function clearCart() { state.cart = []; saveCart(); refreshCartUI(); renderGrid(); }

  function refreshCartUI() {
    const badge = document.getElementById('cartBadge');
    const mBadge = document.getElementById('mCartBadge');
    const n = cartCount();
    const wasHidden = badge.classList.contains('hidden');
    badge.textContent = n;
    badge.classList.toggle('hidden', n === 0);
    if (mBadge) {
      mBadge.textContent = n;
      mBadge.classList.toggle('hidden', n === 0);
    }
    if (n > 0 && wasHidden) {
      badge.classList.remove('pulse');
      void badge.offsetWidth;
      badge.classList.add('pulse');
    }
    renderCartDrawer();
  }

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
    if (changed && !opts.noScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
    if (name === 'orders') loadOrders();
    if (name === 'account') renderAccount();
    if (name === 'checkout') renderCheckoutSummary();
  }

  function updateAuthUI() {
    const user = currentUser();
    const nav = document.getElementById('navAccount');
    nav.textContent = user ? user.name.split(' ')[0] : 'Accedi';
    const pdName = document.getElementById('pdName');
    const pdEmail = document.getElementById('pdEmail');
    const pdHeader = document.querySelector('.profile-dropdown__header');
    const pdBody = document.querySelector('.profile-dropdown__body');
    const pdGuest = document.getElementById('pdGuest');
    if (user) {
      if (pdName) pdName.textContent = user.name;
      if (pdEmail) pdEmail.textContent = user.email;
      if (pdHeader) pdHeader.classList.add('is-shown');
      if (pdBody) pdBody.classList.add('is-shown');
      if (pdGuest) pdGuest.classList.remove('is-shown');
    } else {
      if (pdHeader) pdHeader.classList.remove('is-shown');
      if (pdBody) pdBody.classList.remove('is-shown');
      if (pdGuest) pdGuest.classList.add('is-shown');
    }
  }

  const ICON = (id) => `<svg class="ic"><use href="#${id}"/></svg>`;
  const CAT_ORDER = ['pani', 'dolci', 'piatti', 'bevande'];
  const CAT_META = {
    pani: { label: 'Pane & Focacce', icon: 'ic-bread' },
    dolci: { label: 'Dolci', icon: 'ic-star' },
    piatti: { label: 'Piatti', icon: 'ic-olive' },
    bevande: { label: 'Bevande', icon: 'ic-leaf' },
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
    const present = Array.from(new Set(state.products.map((p) => p.category)))
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
    const grid = document.getElementById('productGrid');
    const term = state.search.trim().toLowerCase();
    let list = state.products;
    if (state.category !== 'tutte') list = list.filter((p) => p.category === state.category);
    if (term) list = list.filter((p) =>
      p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term));

    if (list.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="big">${ICON('ic-search')}</span>Nessun prodotto trovato.</div>`;
      return;
    }
    grid.innerHTML = list.map((p, idx) => {
      const inCart = state.cart.find((i) => i.product_id === p.id);
      const admin = isAdmin();
      const soldOut = p.quantity <= 0;
      const inCartQty = inCart ? inCart.quantity : 0;
      const canAdd = p.available && !soldOut;
      let control;
      if (soldOut) {
        control = '<span class="card__add" style="opacity:.4;cursor:default;border-color:var(--line-dark);color:var(--ink-soft)">Esaurito</span>';
      } else if (inCart) {
        control = `<div class="stepper" data-id="${p.id}">
             <button data-act="dec" aria-label="Togli">&minus;</button>
             <span>${inCartQty}</span>
             <button data-act="inc" aria-label="Aggiungi"${inCartQty >= p.quantity ? ' disabled' : ''}>+</button>
           </div>`;
      } else {
        control = `<button class="btn btn--primary btn--sm" data-add="${p.id}"${!canAdd ? ' disabled' : ''}>Aggiungi</button>`;
      }
      const qtyBadge = p.quantity <= 10
        ? `<span class="card__qty ${p.quantity <= 3 ? 'card__qty--low' : ''}">${p.quantity} disponibili</span>`
        : '';

      let imgHtml = '';
      const rawImages = p.images || '[]';
      let gallery = [];
      try { gallery = JSON.parse(rawImages); } catch { gallery = []; }
      if (gallery.length === 0 && p.image) gallery = [p.image];
      if (gallery.length > 0) {
        if (gallery.length === 1) {
          imgHtml = `<img src="${escapeHtml(gallery[0])}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="var ci=this.parentElement.querySelector('.card__emoji');if(ci)ci.style.display='flex'" />`;
        } else {
          const slides = gallery.map((url, si) => `<div class="prod-carousel__slide"><img src="${escapeHtml(url)}" alt="${escapeHtml(p.name)}" loading="${si === 0 ? 'eager' : 'lazy'}" onerror="var s=this.parentElement.parentElement.parentElement;if(s&&s.querySelector('.card__emoji'))s.querySelector('.card__emoji').style.display='flex'" /></div>`).join('');
          const dots = gallery.map((_, di) => `<button class="prod-carousel__dot${di === 0 ? ' is-active' : ''}" data-idx="${di}" aria-label="Vai all'immagine ${di + 1}"></button>`).join('');
          imgHtml = `<div class="prod-carousel" data-carousel>
            <div class="prod-carousel__track">${slides}</div>
            <button class="prod-carousel__btn prod-carousel__btn--prev" aria-label="Precedente">&#8249;</button>
            <button class="prod-carousel__btn prod-carousel__btn--next" aria-label="Successiva">&#8250;</button>
            <div class="prod-carousel__dots">${dots}</div>
          </div>`;
        }
      }
      const imgWrap = `<div class="card__img">
        <span class="card__emoji" style="font-size:2.4rem;display:${imgHtml ? 'none' : 'flex'};align-items:center;justify-content:center;position:absolute;inset:0">${p.emoji}</span>
        ${imgHtml}
      </div>`;

      const popStyle = animate ? ` style="animation-delay:${Math.min(idx, 12) * 45}ms"` : '';
      const adminBtns = admin ? `
        <div style="display:flex;gap:.3rem;margin-top:.5rem;padding-top:.5rem;border-top:1px solid var(--line)">
          <button class="btn btn--ghost btn--sm" data-edit="${p.id}" style="font-size:.75rem;padding:.3em .6em">Modifica</button>
          <button class="btn btn--ghost btn--sm" data-del="${p.id}" style="font-size:.75rem;padding:.3em .6em;color:var(--err)">Elimina</button>
          ${p.available ? '<button class="btn btn--ghost btn--sm" data-toggle="'+p.id+'" style="font-size:.75rem;padding:.3em .6em">Disattiva</button>'
            : '<button class="btn btn--ghost btn--sm" data-toggle="'+p.id+'" style="font-size:.75rem;padding:.3em .6em;color:var(--olive)">Attiva</button>'}
        </div>` : '';
      return `<article class="card ${animate ? 'pop' : ''} ${p.available ? '' : 'unavailable'}"${popStyle}>
        ${imgWrap}
        <div class="card__body">
          <h3>${escapeHtml(p.name)}</h3>
          <p class="card__desc">${escapeHtml(p.description)}</p>
          <div class="card__foot">
            <span class="card__price">${euro(p.price)}</span>
            ${p.available ? control : ''}
          </div>
          ${qtyBadge}
          ${adminBtns}
        </div>
      </article>`;
    }).join('');

    grid.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
      const p = state.products.find((x) => x.id === Number(b.dataset.add));
      if (p) addToCart(p);
    }));
    grid.querySelectorAll('.stepper').forEach((s) => {
      const id = Number(s.dataset.id);
      s.querySelector('[data-act="inc"]').addEventListener('click', () => changeQty(id, +1));
      s.querySelector('[data-act="dec"]').addEventListener('click', () => changeQty(id, -1));
    });
    grid.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => {
        const p = state.products.find((x) => x.id === Number(b.dataset.edit));
        if (p) openProductModal(p);
      }));
    grid.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', () => deleteProduct(Number(b.dataset.del))));
    grid.querySelectorAll('[data-toggle]').forEach((b) =>
      b.addEventListener('click', async () => {
        const p = state.products.find((x) => x.id === Number(b.dataset.toggle));
        if (!p) return;
        try {
          await API.put(`/api/products/${p.id}`, { available: !p.available });
          toast(`"${p.name}" ${p.available ? 'disattivato' : 'attivato'}.`, 'info');
          await reloadProducts();
        } catch (e) { toast(e.message, 'error'); }
      }));
    setupCarousels(grid);
  }

  function setupCarousels(root) {
    root.querySelectorAll('.prod-carousel[data-carousel]').forEach(function(carousel) {
      if (carousel.dataset.carouselInit === '1') return;
      carousel.dataset.carouselInit = '1';
      var current = 0;
      var track = carousel.querySelector('.prod-carousel__track');
      var slides = track.children;
      var total = slides.length;
      var dots = carousel.querySelectorAll('.prod-carousel__dot');
      var timer = null;
      var touchStartX = 0;
      var touchEndX = 0;

      function goTo(idx) {
        current = Math.max(0, Math.min(total - 1, idx));
        track.style.transform = 'translateX(' + (-current * 100) + '%)';
        dots.forEach(function(d, i) { d.classList.toggle('is-active', i === current); });
      }

      function next() { goTo(current + 1); }
      function prev() { goTo(current - 1); }

      carousel.querySelector('.prod-carousel__btn--next').addEventListener('click', next);
      carousel.querySelector('.prod-carousel__btn--prev').addEventListener('click', prev);
      dots.forEach(function(d) {
        d.addEventListener('click', function() { goTo(Number(d.dataset.idx)); });
      });

      carousel.addEventListener('mouseenter', function() {
        timer = setInterval(function() {
          goTo((current + 1) % total);
        }, 2800);
      });
      carousel.addEventListener('mouseleave', function() {
        if (timer) { clearInterval(timer); timer = null; }
      });

      carousel.addEventListener('touchstart', function(e) { touchStartX = e.touches[0].clientX; }, { passive: true });
      carousel.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].clientX;
        var diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 40) {
          if (diff > 0) next(); else prev();
        }
      }, { passive: true });
    });
  }

  function openCart() {
    document.getElementById('overlay').classList.add('is-visible');
    const drawer = document.getElementById('cartDrawer');
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
  }
  function closeCart() {
    document.getElementById('overlay').classList.remove('is-visible');
    const drawer = document.getElementById('cartDrawer');
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
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
          ? `<img src="${escapeHtml(i.image)}" alt="" loading="lazy" onerror="this.remove()" />`
          : (i.emoji || '')}</span>
        <div class="cart-line__main">
          <strong>${escapeHtml(i.name)}</strong>
          <small>${euro(i.price)} · ${euro(i.price * i.quantity)}</small>
          <div><button class="cart-line__remove" data-rm="${i.product_id}">Rimuovi</button></div>
        </div>
        <div class="stepper" data-id="${i.product_id}">
          <button data-act="dec">&minus;</button><span>${i.quantity}</span><button data-act="inc">+</button>
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

  function goCheckout() {
    if (state.cart.length === 0) { toast('Il carrello è vuoto.', 'error'); return; }
    closeCart();
    if (!currentUser()) {
      state.pendingCheckout = true;
      toast('Accedi o registrati per completare l\'ordine.', 'info');
      showView('account');
      return;
    }
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
      ${state.cart.map((i) => `<div class="summary-row"><span>${i.quantity}&times; ${escapeHtml(i.name)}</span><span>${euro(i.price * i.quantity)}</span></div>`).join('')}
      <div class="summary-row" style="margin-top:.6rem"><span>Subtotale</span><span>${euro(sub)}</span></div>
      ${feeRow}
      <div class="summary-row total"><span>Totale</span><span class="price">${euro(cartTotal())}</span></div>
      <button class="btn btn--olive btn--block btn--lg" id="placeOrderBtn" style="margin-top:1rem">
        ${state.paymentMethod === 'carta' ? ICON('ic-card') + ' Paga ' + euro(cartTotal()) : ICON('ic-check') + ' Conferma ordine'}
      </button>
      <button class="btn btn--ghost btn--block btn--sm" id="backMenuBtn" style="margin-top:.5rem">&larr; Aggiungi altro</button>`;
    box.querySelector('#placeOrderBtn').addEventListener('click', placeOrder);
    box.querySelector('#backMenuBtn').addEventListener('click', () => showView('menu'));
  }

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
      items: state.cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      payment_method: state.paymentMethod,
      order_type: state.orderType,
      card,
      delivery: {
        name: d.name, address: d.address, phone: d.phone,
        scheduled_time: d.scheduled_time, party_size: d.party_size,
      },
      notes: d.notes,
    };
    const data = await API.post('/api/orders', payload);
    state.lastOrder = data.order;
    clearCart();
    return data.order;
  }

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
    document.getElementById('ccPreview').textContent = num.trim() || '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022';
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
        if (!name.value) name.value = (currentUser()?.name) || 'Marta Bianchi';
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
    btn.innerHTML = `<span class="spinner"></span> Elaborazione&hellip;`;
    try {
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

  function confettiBurst() {
    try {
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:300';
      canvas.width = window.innerWidth; canvas.height = window.innerHeight;
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      const colors = ['#c8552a', '#4a5d2a', '#5c3a1e', '#c9a34c', '#25d366', '#f5f0e8'];
      const parts = Array.from({ length: 150 }, () => ({
        x: canvas.width / 2 + (Math.random() - .5) * 220, y: canvas.height * 0.32,
        vx: (Math.random() - .5) * 10, vy: Math.random() * -10 - 4, g: .22 + Math.random() * .12,
        size: 5 + Math.random() * 7, color: colors[(Math.random() * colors.length) | 0],
        rot: Math.random() * 6.28, vr: (Math.random() - .5) * .35,
      }));
      let frame = 0;
      (function tick() {
        frame++;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        parts.forEach((p) => {
          p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, 1 - frame / 170);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .62); ctx.restore();
        });
        if (frame < 175) requestAnimationFrame(tick); else canvas.remove();
      })();
    } catch (_) {}
  }

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
      <p class="muted">Ordine <strong>#${order.id}</strong> &mdash; ${orderTypeChip(order.order_type)}</p>
      <p class="muted" style="font-size:.92rem;margin-top:.2rem">${detail}</p>
      <p style="margin:.8rem 0">${paidLabel}</p>
      <div class="panel" style="max-width:420px;margin:1.2rem auto;text-align:left">
        ${order.items.map((i) => `<div class="summary-row"><span>${i.quantity}&times; ${escapeHtml(i.product_name)}</span><span>${euro(i.unit_price * i.quantity)}</span></div>`).join('')}
        ${feeRow}
        <div class="summary-row total"><span>Totale</span><span class="price">${euro(order.total)}</span></div>
      </div>
      <div style="display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap">
        <button class="btn btn--primary" id="seeOrders">${ICON('ic-package')} I miei ordini</button>
        <button class="btn btn--ghost" id="backHome">Torna al menu</button>
      </div>`;
    document.getElementById('seeOrders').addEventListener('click', () => showView('orders'));
    document.getElementById('backHome').addEventListener('click', () => showView('menu'));
    ['dNotes'].forEach((id) => (document.getElementById(id).value = ''));
    ['ccNumber', 'ccExp', 'ccCvc'].forEach((id) => (document.getElementById(id).value = ''));
    confettiBurst();
  }

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
    return `<div class="progress-bar">${STATUS_FLOW.map((s, i) => {
      const cls = i <= idx ? 'done' : '';
      return `<div class="progress-step ${i === idx ? 'current' : ''} ${cls}"></div>`;
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
    list.innerHTML = `<div class="empty-state">Caricamento&hellip;</div>`;
    try {
      const { orders } = await API.get('/api/orders/mine');
      if (orders.length === 0) {
        list.innerHTML = `<div class="empty-state"><span class="big">${ICON('ic-package')}</span>Non hai ancora ordinato nulla.<br/>
          <button class="btn btn--primary" id="goMenu2" style="margin-top:1rem">Vai al menu</button></div>`;
        list.querySelector('#goMenu2').addEventListener('click', () => showView('menu'));
        return;
      }
      list.innerHTML = orders.map((o) => `
        <div class="order-summary">
          <div class="order-summary__header">
            <span class="order-card__id">Ordine #${o.id}</span>
            <div style="display:flex;gap:.35rem;flex-wrap:wrap">
              ${orderTypeBadge(o)}
              <span class="status-badge status-${o.status}">${statusLabelFor(o.order_type, o.status)}</span>
              <span class="status-badge" style="background:rgba(61,40,23,.06);color:var(--brown);font-size:.7rem">${o.payment_method === 'carta' ? ICON('ic-card') + ' Carta' : ICON('ic-cash') + ' Contanti'}</span>
            </div>
          </div>
          <small class="muted">${formatDate(o.created_at)} · ${orderTypeLine(o)}</small>
          <div class="order-summary__items">
            ${o.items.map((i) => `<div class="summary-row"><span>${i.quantity}&times; ${escapeHtml(i.product_name)}</span><span>${euro(i.unit_price * i.quantity)}</span></div>`).join('')}
          </div>
          <div class="order-summary__total">Totale ${euro(o.total)}</div>
          ${timelineHtml(o)}
        </div>`).join('');
    } catch (e) {
      list.innerHTML = `<div class="empty-state">Errore nel caricamento.</div>`;
      toast(e.message, 'error');
    }
  }

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
          <h4 style="font-weight:600;color:var(--brown);text-transform:none;letter-spacing:0;margin-bottom:.8rem">Cambia password</h4>
          <div id="pwFormError" class="form-error"></div>
          <div class="field"><label>Password attuale</label><input type="password" id="pfCurrPass" placeholder="••••••" /></div>
          <div class="field"><label>Nuova password</label><input type="password" id="pfNewPass" placeholder="almeno 6 caratteri" /></div>
          <button class="btn btn--olive" id="changePassBtn">Aggiorna password</button>
          <hr style="border:0;border-top:1px solid var(--line);margin:1.4rem 0" />
          <button class="btn btn--olive btn--block" id="goOrders">${ICON('ic-package')} Vedi i miei ordini</button>
        </div>`;
      area.querySelector('#saveProfile').addEventListener('click', saveProfile);
      area.querySelector('#logoutBtn').addEventListener('click', logout);
      area.querySelector('#changePassBtn').addEventListener('click', changePassword);
      area.querySelector('#goOrders').addEventListener('click', () => showView('orders'));
      return;
    }
    area.innerHTML = `
      <div class="panel">
        <div class="auth-tabs">
          <button class="is-active" data-tab="login">Accedi</button>
          <button data-tab="register">Registrati</button>
        </div>
        <form id="loginForm">
          <div class="field"><label>Email</label><input type="email" id="liEmail" placeholder="tu@email.it" required /></div>
          <div class="field"><label>Password</label><input type="password" id="liPass" placeholder="••••••" required /></div>
          <button class="btn btn--primary btn--block btn--lg" type="submit">Accedi</button>
          <p class="muted" style="font-size:.8rem;margin-top:.8rem;text-align:center">Demo: marta@example.com / marta123</p>
        </form>
        <form id="registerForm" class="hidden">
          <div class="field"><label>Nome e cognome</label><input id="rgName" placeholder="Marta Bianchi" required /></div>
          <div class="field"><label>Email</label><input type="email" id="rgEmail" placeholder="tu@email.it" required /></div>
          <div class="field"><label>Password</label><input type="password" id="rgPass" placeholder="almeno 6 caratteri" required /></div>
          <div class="field"><label>Indirizzo (facoltativo)</label><input id="rgAddr" placeholder="Via, civico, città" /></div>
          <div class="field"><label>Telefono (facoltativo)</label><input id="rgPhone" placeholder="Numero di telefono" /></div>
          <button class="btn btn--primary btn--block btn--lg" type="submit">Crea account</button>
        </form>
      </div>`;

    const tabs = area.querySelectorAll('.auth-tabs button');
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
    renderAdminBar();
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

  async function changePassword() {
    const errEl = document.getElementById('pwFormError');
    errEl.textContent = '';
    const curr = document.getElementById('pfCurrPass').value;
    const next = document.getElementById('pfNewPass').value;
    if (!curr) { errEl.textContent = 'Inserisci la password attuale.'; return; }
    if (!next || next.length < 6) { errEl.textContent = 'La nuova password deve avere almeno 6 caratteri.'; return; }
    try {
      await API.put('/api/auth/me/password', { currentPassword: curr, newPassword: next });
      document.getElementById('pfCurrPass').value = '';
      document.getElementById('pfNewPass').value = '';
      toast('Password aggiornata con successo.', 'success');
    } catch (e) { errEl.textContent = e.message; }
  }

  function logout() {
    clearAuth(); updateAuthUI(); renderAdminBar(); closeProfileDropdown(); toast('Disconnesso.', 'info'); showView('menu');
  }

  async function refreshUser() {
    if (!API.token()) return;
    try {
      const { user } = await API.get('/api/auth/me');
      setAuth(API.token(), user);
    } catch (e) {
      if (e.status === 401) clearAuth();
    }
  }

  function isAdmin() {
    const u = currentUser();
    return u && u.role === 'admin';
  }

  function renderAdminBar() {
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar) return;
    const existing = document.getElementById('adminAddBtn');
    if (isAdmin()) {
      toolbar.classList.add('toolbar--admin');
      if (!existing) {
        const b = document.createElement('button');
        b.id = 'adminAddBtn';
        b.className = 'btn btn--olive btn--sm';
        b.textContent = '\uFF0B Nuovo prodotto';
        b.style.flexShrink = '0';
        b.addEventListener('click', () => openProductModal(null));
        toolbar.appendChild(b);
      }
    } else {
      toolbar.classList.remove('toolbar--admin');
      if (existing) existing.remove();
    }
    renderGrid(true);
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
      galleryImages.splice(Number(rm.dataset.idx), 1);
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

    list.addEventListener('dragend', function() {
      dragIdx = -1;
      list.querySelectorAll('.gallery-thumb').forEach(function(t) { t.style.opacity = '1'; });
      list.querySelectorAll('.drag-over').forEach(function(t) { t.classList.remove('drag-over'); });
    });

    list.addEventListener('dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });

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
    if (!input || !input.files || input.files.length === 0) return;
    const files = Array.from(input.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) { if (input) input.value = ''; return; }
    let loaded = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = function() {
        galleryImages.push(reader.result);
        loaded++;
        if (loaded >= files.length) { if (input) input.value = ''; renderGallery(); }
      };
      reader.readAsDataURL(file);
    });
  }

  function openProductModal(product) {
    document.getElementById('productFormError').textContent = '';
    document.getElementById('productModalTitle').textContent = product ? 'Modifica prodotto' : 'Nuovo prodotto';
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
    document.getElementById('productModalOverlay').classList.add('is-open');
  }

  function closeProductModal() {
    document.getElementById('productModalOverlay').classList.remove('is-open');
  }

  async function saveProduct() {
    const id = document.getElementById('pzId').value;
    const euros = parseFloat(document.getElementById('pzPrice').value);
    if (!document.getElementById('pzName').value.trim()) {
      document.getElementById('productFormError').textContent = 'Inserisci il nome.'; return;
    }
    if (!Number.isFinite(euros) || euros < 0) {
      document.getElementById('productFormError').textContent = 'Prezzo non valido.'; return;
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
      toast('Prodotto salvato.', 'success');
      closeProductModal();
      await reloadProducts();
    } catch (e) { document.getElementById('productFormError').textContent = e.message; }
  }

  async function deleteProduct(id) {
    const p = state.products.find((x) => x.id === id);
    if (!p || !confirm(`Eliminare "${p.name}" dal menu?`)) return;
    try {
      await API.del(`/api/products/${id}`);
      toast('Prodotto eliminato.', 'info');
      await reloadProducts();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function reloadProducts() {
    try {
      const { products } = await API.get('/api/products');
      state.products = products.sort((a, b) =>
        catRank(a.category) - catRank(b.category) || a.name.localeCompare(b.name));
      renderPills();
      renderGrid(true);
    } catch (e) { toast('Errore nel ricaricare il menu.', 'error'); }
  }

  async function init() {
    document.querySelectorAll('[data-nav]').forEach((el) =>
      el.addEventListener('click', (e) => { e.preventDefault(); showView(el.dataset.nav); }));
    document.getElementById('cartBtn').addEventListener('click', openCart);
    document.getElementById('mCartBtn').addEventListener('click', openCart);
    document.getElementById('closeCart').addEventListener('click', closeCart);
    document.getElementById('overlay').addEventListener('click', closeCart);
    document.getElementById('searchInput').addEventListener('input', (e) => {
      state.search = e.target.value; renderGrid(true);
    });

    document.querySelectorAll('.pay-option').forEach((opt) =>
      opt.addEventListener('click', () => {
        document.querySelectorAll('.pay-option').forEach((o) => o.classList.remove('is-active'));
        opt.classList.add('is-active');
        opt.querySelector('input').checked = true;
        state.paymentMethod = opt.dataset.method;
        if (currentView() === 'checkout') renderCheckoutSummary();
      }));

    document.querySelectorAll('.order-type').forEach((opt) =>
      opt.addEventListener('click', () => setOrderType(opt.dataset.type)));
    setOrderType('consegna');

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

    const profileBtn = document.getElementById('profileBtn');
    const profileDropdown = document.getElementById('profileDropdown');
    if (profileBtn) {
      profileBtn.addEventListener('click', function(e) { e.stopPropagation(); toggleProfileDropdown(); });
    }
    document.addEventListener('click', function(e) {
      if (profileDropdown && !profileDropdown.contains(e.target) && e.target !== profileBtn) {
        closeProfileDropdown();
      }
    });
    if (profileDropdown) {
      profileDropdown.querySelectorAll('[data-nav]').forEach(function(el) {
        el.addEventListener('click', function() { closeProfileDropdown(); showView(el.dataset.nav); });
      });
      const pdLogout = document.getElementById('pdLogout');
      if (pdLogout) pdLogout.addEventListener('click', logout);
    }

    document.getElementById('closeProductModal').addEventListener('click', closeProductModal);
    document.getElementById('saveProductBtn').addEventListener('click', saveProduct);
    document.getElementById('productModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'productModalOverlay') closeProductModal();
    });
    const fileInput = document.getElementById('pzImageFile');
    if (fileInput) fileInput.addEventListener('change', handleImageFiles);
    setupGalleryDelegation();

    let retries = 3;
    while (retries > 0) {
      try {
        const [cfg, data] = await Promise.all([API.get('/api/config'), API.get('/api/products')]);
        state.config = cfg;
        state.products = data.products.sort((a, b) =>
          catRank(a.category) - catRank(b.category) || a.name.localeCompare(b.name));
        console.log('Menu caricato:', state.products.length, 'prodotti');
        break;
      } catch (e) {
        retries--;
        console.error(`Errore caricamento menu (${retries} tentativi rimasti):`, e);
        if (retries === 0) toast('Impossibile caricare il menu. Riprova ricaricando la pagina.', 'error');
        else await new Promise(r => setTimeout(r, 2000));
      }
    }

    renderPills();
    renderGrid(true);
    refreshCartUI();
    await refreshUser();
    updateAuthUI();
    renderAdminBar();
    showView('menu');
    setupAnimations();
    setupCookieBanner();
  }

  function setupAnimations() {
    const header = document.querySelector('.site-header');
    if (header) {
      const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    const mapFrame = document.querySelector('.contact__map iframe[data-src]');
    const loadMap = () => { if (mapFrame && !mapFrame.src) mapFrame.src = mapFrame.dataset.src; };
    const mapOverlay = document.getElementById('mapOverlay');
    if (mapOverlay) {
      mapOverlay.addEventListener('click', () => {
        mapOverlay.classList.add('is-hidden');
        loadMap();
      });
    }

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

    setTimeout(revealAll, 1600);

    if (mapFrame) {
      const mapIo = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { loadMap(); mapIo.disconnect(); }
      }, { rootMargin: '400px' });
      mapIo.observe(mapFrame);
    }
  }

  function setupCookieBanner() {
    const banner = document.getElementById('cookieBanner');
    if (!banner) return;
    const stored = localStorage.getItem('forno_cookie_consent');
    if (stored) return;
    banner.classList.add('is-open');

    function saveConsent(analytics, marketing) {
      localStorage.setItem('forno_cookie_consent', JSON.stringify({
        necessary: true, analytics, marketing, date: new Date().toISOString()
      }));
      banner.classList.remove('is-open');
    }

    document.getElementById('acceptAllCookies').addEventListener('click', () => saveConsent(true, true));
    document.getElementById('manageCookies').addEventListener('click', () => {
      document.getElementById('cookieDetails').classList.toggle('is-open');
    });
    document.getElementById('saveCookies').addEventListener('click', () => {
      saveConsent(
        document.getElementById('cookieAnalytics').checked,
        document.getElementById('cookieMarketing').checked
      );
    });
  }

  function toggleProfileDropdown() {
    document.getElementById('profileDropdown').classList.toggle('is-open');
  }
  function closeProfileDropdown() {
    document.getElementById('profileDropdown').classList.remove('is-open');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
