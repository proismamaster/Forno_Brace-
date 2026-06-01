// Simulazione del pagamento con carta in stile Stripe.
//
// NB: questo è un SIMULATORE didattico, non contatta i server di Stripe e non
// muove denaro reale. Riproduce però lo stesso flusso (token carta -> esito ->
// id transazione) così da poter essere sostituito facilmente con Stripe vero.
//
// Per usare Stripe REALE (modalità test) basterebbe:
//   1) npm install stripe
//   2) const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
//   3) creare un PaymentIntent invece di chiamare simulateCardPayment().
//
// Carte di test riconosciute dal simulatore:
//   4242 4242 4242 4242  -> pagamento APPROVATO
//   4000 0000 0000 0002  -> carta RIFIUTATA
//   4000 0000 0000 9995  -> fondi INSUFFICIENTI

function luhnValid(number) {
  const digits = number.split('').reverse().map(Number);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits[i];
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function randomRef() {
  return 'ch_sim_' + Math.random().toString(36).slice(2, 12);
}

// card = { number, exp, cvc, name }
function simulateCardPayment(card, amountCents) {
  const number = String(card?.number || '').replace(/\s+/g, '');
  const exp = String(card?.exp || '').trim();
  const cvc = String(card?.cvc || '').trim();

  // Validazioni di base, come farebbe un vero form di pagamento.
  if (!/^\d{13,19}$/.test(number)) {
    return { ok: false, code: 'invalid_number', message: 'Numero carta non valido.' };
  }
  if (!luhnValid(number)) {
    return { ok: false, code: 'invalid_number', message: 'Numero carta non valido (controllo Luhn).' };
  }
  if (!/^\d{2}\s*\/\s*\d{2,4}$/.test(exp)) {
    return { ok: false, code: 'invalid_expiry', message: 'Data di scadenza non valida (usa MM/AA).' };
  }
  if (!/^\d{3,4}$/.test(cvc)) {
    return { ok: false, code: 'invalid_cvc', message: 'CVC non valido.' };
  }

  // Esiti speciali in base alla carta di test usata.
  if (number === '4000000000000002') {
    return { ok: false, code: 'card_declined', message: 'Carta rifiutata dalla banca.' };
  }
  if (number === '4000000000009995') {
    return { ok: false, code: 'insufficient_funds', message: 'Fondi insufficienti.' };
  }

  // Qualsiasi altra carta valida -> pagamento approvato.
  return {
    ok: true,
    code: 'approved',
    message: 'Pagamento approvato.',
    reference: randomRef(),
    last4: number.slice(-4),
    amount: amountCents,
  };
}

module.exports = { simulateCardPayment };
