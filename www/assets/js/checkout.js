/**
 * ZL · Zen Luxury — Checkout
 * PayPal (+ iDEAL) — EUR — Accepts Visa, Mastercard, Amex, Discover, PayPal, Venmo
 */

// ─────────────────────────────────────
// CONFIG
// ─────────────────────────────────────
const PROMO_CODES = {
  'ZL10':  0.10,
  'ZL20':  0.20,
  'ZLVIP': 0.25,
};
const TAX_RATE            = 0.08;
const SHIPPING_RATES      = { standard: 0, express: 0.10, overnight: 0.25 };
const FREE_SHIP_THRESHOLD = 0.50;  // lowered for test prices

// ─────────────────────────────────────
// STATE
// ─────────────────────────────────────
function getCart() {
  try { return JSON.parse(localStorage.getItem('zl-cart') || '[]'); }
  catch (e) { return []; }
}

let discount     = 0;
let shippingCost = 0;
const rendered   = { ideal: false, klarna: false, card: false, bancontact: false }; // lazy render flags
let activeMethod = 'ideal';                                       // default tab
let selectedBankBic = null;                                        // iDEAL bank BIC

// ─────────────────────────────────────
// MATH
// ─────────────────────────────────────
function getSubtotal() { return getCart().reduce((s, i) => s + i.price * i.qty, 0); }
function getTotal()    { return (getSubtotal() * (1 - discount)) * (1 + TAX_RATE) + shippingCost; }
function fmt(n)        { return '€' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

// ─────────────────────────────────────
// ORDER SUMMARY
// ─────────────────────────────────────
function renderOrderSummary() {
  const cart     = getCart();
  const itemsEl  = document.getElementById('order-items');
  const totalsEl = document.getElementById('order-totals');

  if (!cart.length) {
    if (itemsEl) itemsEl.innerHTML = `
      <div style="text-align:center;padding:2rem 0;">
        <p style="color:var(--grey);font-size:.83rem;">Your cart is empty</p>
        <a href="shop.html" class="btn btn--outline" style="margin-top:1rem;font-size:.65rem;">Shop Now</a>
      </div>`;
    if (totalsEl) totalsEl.style.display = 'none';
    updatePaymentSection(false);
    return;
  }

  if (itemsEl) {
    itemsEl.innerHTML = cart.map(item => `
      <div class="order-item">
        <img class="order-item__img" src="${item.image}" alt="${item.name}" loading="lazy"/>
        <div class="order-item__info">
          <p class="order-item__name">${item.name}</p>
          <p class="order-item__variant">${item.variant || 'One Size'} &middot; Qty ${item.qty}</p>
          <p class="order-item__price">${fmt(item.price * item.qty)}</p>
        </div>
      </div>`).join('');
  }

  if (totalsEl) {
    totalsEl.style.display = '';
    const sub   = getSubtotal();
    const disc  = sub * discount;
    const tax   = (sub - disc) * TAX_RATE;
    const total = sub - disc + tax + shippingCost;
    const set   = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('ot-subtotal', fmt(sub));
    set('ot-shipping', shippingCost === 0 ? 'Free' : fmt(shippingCost));
    set('ot-tax',      fmt(tax));
    set('ot-total',    fmt(total));
    const discRow = document.getElementById('ot-discount-row');
    const discEl  = document.getElementById('ot-discount');
    if (discRow) discRow.style.display = discount > 0 ? '' : 'none';
    if (discEl && discount > 0)
      discEl.textContent = `-${fmt(disc)} (${Math.round(discount * 100)}% off)`;
  }

  updatePaymentSection(true);
}

// ─────────────────────────────────────
// PAYMENT SECTION VISIBILITY
// ─────────────────────────────────────
function updatePaymentSection(hasItems) {
  const emptyMsg = document.getElementById('paypal-empty-msg');
  const pmWrap   = document.getElementById('pm-wrap');
  if (!hasItems) {
    if (emptyMsg) emptyMsg.style.display = 'block';
    if (pmWrap)   pmWrap.style.display   = 'none';
    return;
  }
  if (emptyMsg) emptyMsg.style.display = 'none';
  if (pmWrap)   pmWrap.style.display   = '';
  renderPaymentButtons(activeMethod);
}

// Keep old name for shipping change handler
function updatePayPalSection(hasItems) { updatePaymentSection(hasItems); }

// ─────────────────────────────────────
// PAYMENT TAB SWITCHING
// ─────────────────────────────────────
window.switchPayment = function(method) {
  activeMethod = method;
  // Highlight the selected row
  document.querySelectorAll('.pm-row').forEach(r => {
    r.classList.toggle('active', r.dataset.method === method);
  });
  // Show / hide expansion panels
  ['ideal','klarna','card','bancontact'].forEach(m => {
    const panel = document.getElementById(`pm-expand-${m}`);
    if (panel) panel.style.display = m === method ? '' : 'none';
  });
  if (getCart().length) renderPaymentButtons(method);
};



// ─────────────────────────────────────
// IDEAL BANK SELECTION
// ─────────────────────────────────────
window.selectBank = function(btn) {
  document.querySelectorAll('.bank-tile-select').forEach(t => t.classList.remove('selected'));
  btn.classList.add('selected');
  selectedBankBic = btn.dataset.bic || null;
  const name = btn.dataset.name || '';
  const msg  = document.getElementById('bank-selected-msg');
  if (msg) { msg.textContent = '\u2713 ' + name + ' geselecteerd'; msg.style.display = ''; }
};

// ─────────────────────────────────────
// SHARED ORDER HANDLERS
// ─────────────────────────────────────
function buildOrder(actions) {
  const cart  = getCart();
  const total = getTotal();
  return actions.order.create({
    purchase_units: [{
      reference_id: 'ZL-ORDER',
      description:  'ZL · Zen Luxury Order',
      amount: {
        value:         total.toFixed(2),
        currency_code: 'EUR',
        breakdown: {
          item_total: { value: (getSubtotal() * (1 - discount)).toFixed(2), currency_code: 'EUR' },
          tax_total:  { value: ((getSubtotal() * (1 - discount)) * TAX_RATE).toFixed(2), currency_code: 'EUR' },
          shipping:   { value: shippingCost.toFixed(2), currency_code: 'EUR' },
        },
      },
      items: cart.map(item => ({
        name:        item.name,
        unit_amount: { value: item.price.toFixed(2), currency_code: 'EUR' },
        quantity:    String(item.qty),
        description: `Size: ${item.variant || 'One Size'}`,
        category:    'PHYSICAL_GOODS',
      })),
      shipping: {
        address: {
          address_line_1: document.getElementById('address')?.value   ?? '',
          address_line_2: document.getElementById('address2')?.value  ?? '',
          admin_area_2:   document.getElementById('city')?.value      ?? '',
          admin_area_1:   document.getElementById('state')?.value     ?? '',
          postal_code:    document.getElementById('zip')?.value       ?? '',
          country_code:   document.getElementById('country')?.value   ?? 'NL',
        },
      },
    }],
    application_context: { brand_name: 'Zen Luxury Worldwide', user_action: 'PAY_NOW' },
    // Pre-select bank so PayPal redirects directly to that bank (skips PayPal bank picker)
    ...(selectedBankBic && activeMethod === 'ideal' ? {
      payment_source: { ideal: { bic: selectedBankBic, country_code: 'NL' } },
    } : {}),
  });
}

function handleApprove(data, actions) {
  return actions.order.capture().then(details => {
    saveOrder(details);
    localStorage.removeItem('zl-cart');
    showToast('Payment confirmed — thank you!');
    setTimeout(() => { window.location.href = 'order-confirm.html'; }, 800);
  });
}
function handleCancel()   { showToast('Payment cancelled. Your cart is still saved.'); }
function handleError(err) { console.error('Payment error:', err); showToast('Payment error. Please try again.'); }

const onClick = (data, actions) => {
  if (activeMethod === 'ideal' && !selectedBankBic) {
    showToast('Selecteer eerst je bank om te betalen via iDEAL.');
    document.getElementById('bank-select-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return actions.reject();
  }
  if (!validateForm()) return actions.reject();
  return actions.resolve();
};
const btnBase = { onClick, createOrder: (d,a) => buildOrder(a), onApprove: handleApprove, onCancel: handleCancel, onError: handleError };

// ─────────────────────────────────────
// RENDER PAYMENT BUTTONS (lazy per tab)
// ─────────────────────────────────────
function renderPaymentButtons(method) {
  if (typeof paypal === 'undefined') return;

  if (method === 'ideal' && !rendered.ideal) {
    rendered.ideal = true;
    const loadingMsg  = document.getElementById('paypal-loading-msg');
    const instruction = document.getElementById('ideal-instruction');
    const container   = document.getElementById('ideal-button-container');
    if (loadingMsg) loadingMsg.style.display = 'none';
    try {
      const idealBtn = paypal.Buttons({ ...btnBase, fundingSource: paypal.FUNDING.IDEAL, style: { height: 50, shape: 'rect' } });
      if (idealBtn.isEligible()) {
        idealBtn.render('#ideal-button-container');
      } else {
        paypal.Buttons({ ...btnBase, style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay', height: 50 } }).render('#ideal-button-container');
      }
      if (instruction) instruction.style.display = '';
    } catch (e) {
      if (container) container.innerHTML = '<p style="font-size:.78rem;color:var(--grey);text-align:center;padding:.5rem 0;">iDEAL tijdelijk niet beschikbaar. Vernieuw de pagina.</p>';
    }
  }

  if (method === 'klarna' && !rendered.klarna) {
    rendered.klarna = true;
    const kl = document.getElementById('klarna-loading-msg');
    const kn = document.getElementById('klarna-eligible-msg');
    const kc = document.getElementById('klarna-button-container');
    if (kl) kl.style.display = 'none';
    try {
      paypal.Buttons({ ...btnBase, style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 50 } }).render('#klarna-button-container');
      if (kn) kn.style.display = '';
    } catch (e) {
      if (kc) kc.innerHTML = '<p style="font-size:.78rem;color:var(--grey);text-align:center;padding:.5rem 0;">Betaalknop kon niet laden. Vernieuw de pagina.</p>';
    }
  }

  if (method === 'card' && !rendered.card) {
    rendered.card = true;
    const cc = document.getElementById('card-paypal-container');
    try {
      paypal.Buttons({ ...btnBase, style: { layout: 'vertical', color: 'white', shape: 'rect', label: 'pay', height: 50 } }).render('#card-paypal-container');
    } catch (e) {
      if (cc) cc.innerHTML = '<p style="font-size:.78rem;color:var(--grey);text-align:center;padding:.5rem 0;">Betaalknop kon niet laden. Vernieuw de pagina.</p>';
    }
  }

  if (method === 'bancontact' && !rendered.bancontact) {
    rendered.bancontact = true;
    const bc = document.getElementById('bancontact-button-container');
    try {
      const bcBtn = paypal.Buttons({ ...btnBase, fundingSource: paypal.FUNDING.BANCONTACT, style: { height: 50, shape: 'rect' } });
      if (bcBtn.isEligible()) {
        bcBtn.render('#bancontact-button-container');
      } else {
        paypal.Buttons({ ...btnBase, style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay', height: 50 } }).render('#bancontact-button-container');
      }
    } catch (e) {
      if (bc) bc.innerHTML = '<p style="font-size:.78rem;color:var(--grey);text-align:center;padding:.5rem 0;">Bancontact tijdelijk niet beschikbaar.</p>';
    }
  }
}

// ─────────────────────────────────────
// SHIPPING SELECTION
// ─────────────────────────────────────
document.querySelectorAll('input[name="shipping"]').forEach(radio => {
  radio.addEventListener('change', () => {
    document.querySelectorAll('#shipping-methods .payment-method').forEach(m => m.classList.remove('selected'));
    radio.closest('.payment-method').classList.add('selected');
    const sub = getSubtotal();
    shippingCost = (radio.value === 'standard' && sub >= FREE_SHIP_THRESHOLD) ? 0 : (SHIPPING_RATES[radio.value] ?? 0);
    const lbl = document.getElementById('shipping-cost-label');
    if (lbl && radio.value === 'standard') lbl.textContent = sub >= FREE_SHIP_THRESHOLD ? 'FREE' : fmt(SHIPPING_RATES.standard || 0);
    renderOrderSummary();

    // Re-render buttons on shipping change (amount changed)
    Object.keys(rendered).forEach(k => rendered[k] = false);
    ['ideal-button-container','klarna-button-container','card-paypal-container','bancontact-button-container'].forEach(id => { const c = document.getElementById(id); if (c) c.innerHTML = ''; });
    const instruction = document.getElementById('ideal-instruction');
    if (instruction) instruction.style.display = 'none';
    // Reset bank selection
    selectedBankBic = null;
    const klarnaMsg = document.getElementById('klarna-eligible-msg');
    if (klarnaMsg) klarnaMsg.style.display = 'none';
    document.querySelectorAll('.bank-tile-select').forEach(t => t.classList.remove('selected'));
    const bankMsg = document.getElementById('bank-selected-msg');
    if (bankMsg) { bankMsg.textContent = ''; bankMsg.style.display = 'none'; }
    const loadingMsg = document.getElementById('paypal-loading-msg');
    if (loadingMsg) { loadingMsg.textContent = 'Betaalknop wordt geladen\u2026'; loadingMsg.style.display = ''; }
    renderPaymentButtons(activeMethod);
  });
});

// ─────────────────────────────────────
// PROMO CODE
// ─────────────────────────────────────
window.applyPromo = function() {
  const code = (document.getElementById('promo-input')?.value || '').trim().toUpperCase();
  const msg  = document.getElementById('promo-msg');
  if (PROMO_CODES[code] !== undefined) {
    discount = PROMO_CODES[code];
    if (msg) { msg.textContent = `✓ ${Math.round(discount * 100)}% discount applied`; msg.style.color = 'var(--gold)'; }
  } else {
    discount = 0;
    if (msg) { msg.textContent = 'Invalid promo code.'; msg.style.color = '#c0392b'; }
  }
  renderOrderSummary();
};

// ─────────────────────────────────────
// FORM VALIDATION
// ─────────────────────────────────────
function validateForm() {
  const required = ['email', 'first-name', 'last-name', 'address', 'city', 'zip'];
  for (const id of required) {
    const el = document.getElementById(id);
    if (!el?.value.trim()) {
      el?.focus();
      showToast('Please fill in all required shipping fields before paying.');
      if (el?.style) { el.style.borderColor = 'var(--red)'; setTimeout(() => { if (el.style) el.style.borderColor = ''; }, 2500); }
      return false;
    }
  }
  const emailEl = document.getElementById('email');
  if (emailEl && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value)) {
    emailEl.focus(); showToast('Please enter a valid email address.'); return false;
  }
  return true;
}

// ─────────────────────────────────────
// SAVE ORDER
// ─────────────────────────────────────
function saveOrder(paypalDetails) {
  const cart    = getCart();
  const orderId = 'ZL-' + Date.now().toString(36).toUpperCase();
  const order   = {
    id: orderId, paypalId: paypalDetails?.id ?? 'PP-' + Date.now(),
    date: new Date().toISOString(), items: [...cart],
    shipping: {
      firstName: document.getElementById('first-name')?.value ?? '',
      lastName:  document.getElementById('last-name')?.value  ?? '',
      address:   document.getElementById('address')?.value    ?? '',
      address2:  document.getElementById('address2')?.value   ?? '',
      city:      document.getElementById('city')?.value       ?? '',
      state:     document.getElementById('state')?.value      ?? '',
      zip:       document.getElementById('zip')?.value        ?? '',
      country:   document.getElementById('country')?.value    ?? '',
      phone:     document.getElementById('phone')?.value      ?? '',
    },
    email: document.getElementById('email')?.value ?? '',
    shippingCost, discount,
    subtotal: getSubtotal(), tax: (getSubtotal() * (1 - discount)) * TAX_RATE,
    total: getTotal(), paymentMethod: 'PayPal',
  };
  localStorage.setItem('zl-last-order', JSON.stringify(order));
  return order;
}

// ─────────────────────────────────────
// INIT
// ─────────────────────────────────────
function init() {
  renderOrderSummary();
  const sub = getSubtotal();
  if (sub >= FREE_SHIP_THRESHOLD) {
    const lbl = document.getElementById('shipping-cost-label');
    if (lbl) lbl.textContent = 'FREE';
  }

  // Poll for PayPal SDK (defer — arrives after inline scripts)
  if (typeof paypal !== 'undefined') {
    renderPaymentButtons(activeMethod);
  } else {
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      if (typeof paypal !== 'undefined') {
        clearInterval(poll);
        renderPaymentButtons(activeMethod);
      } else if (attempts >= 25) {
        clearInterval(poll);
        const msg = document.getElementById('paypal-loading-msg');
        if (msg) { msg.textContent = 'Kon betalingsknop niet laden. Vernieuw de pagina.'; msg.style.color = 'var(--red)'; }
      }
    }, 400);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
