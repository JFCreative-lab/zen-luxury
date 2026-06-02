/**
 * ZL · Zen Luxury — Checkout
 * PayPal Smart Buttons — accepts Visa, Mastercard, Amex, Discover, PayPal, Venmo
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
const SHIPPING_RATES      = { standard: 0, express: 12, overnight: 28 };
const FREE_SHIP_THRESHOLD = 150;

// ─────────────────────────────────────
// STATE — always read fresh from localStorage
// (avoids stale data if script loads before DOM or main.js)
// ─────────────────────────────────────
function getCart() {
  try { return JSON.parse(localStorage.getItem('zl-cart') || '[]'); }
  catch (e) { return []; }
}

let discount     = 0;
let shippingCost = 0;
let paypalInited = false;

// ─────────────────────────────────────
// MATH
// ─────────────────────────────────────
function getSubtotal() {
  return getCart().reduce((s, i) => s + i.price * i.qty, 0);
}

function getTotal() {
  const sub  = getSubtotal();
  const disc = sub * discount;
  return (sub - disc) * (1 + TAX_RATE) + shippingCost;
}

function fmt(n) {
  return '€' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ─────────────────────────────────────
// ORDER SUMMARY
// ─────────────────────────────────────
function renderOrderSummary() {
  const cart     = getCart();                                   // fresh read
  const itemsEl  = document.getElementById('order-items');
  const totalsEl = document.getElementById('order-totals');

  if (!cart.length) {
    if (itemsEl) itemsEl.innerHTML = `
      <div style="text-align:center;padding:2rem 0;">
        <p style="color:var(--grey);font-size:.83rem;">Your cart is empty</p>
        <a href="shop.html" class="btn btn--outline" style="margin-top:1rem;font-size:.65rem;">Shop Now</a>
      </div>`;
    if (totalsEl) totalsEl.style.display = 'none';
    updatePayPalSection(false);
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

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
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

  updatePayPalSection(true);
}

// ─────────────────────────────────────
// PAYMENT SECTION STATE
// ─────────────────────────────────────
function updatePayPalSection(hasItems) {
  const loadingMsg  = document.getElementById('paypal-loading-msg');
  const emptyMsg    = document.getElementById('paypal-empty-msg');
  const payWrap     = document.getElementById('paypal-checkout-wrap');
  const idealWrap   = document.getElementById('ideal-checkout-wrap');
  const separator   = document.querySelector('.pay-separator');

  if (!hasItems) {
    if (loadingMsg) loadingMsg.style.display = 'none';
    if (emptyMsg)   emptyMsg.style.display   = 'block';
    if (payWrap)    payWrap.style.display     = 'none';
    if (idealWrap)  idealWrap.style.display   = 'none';
    if (separator)  separator.style.display   = 'none';
    return;
  }

  if (emptyMsg)  emptyMsg.style.display  = 'none';
  if (payWrap)   payWrap.style.display   = '';
  if (idealWrap) idealWrap.style.display = '';
  if (separator) separator.style.display = '';
  initPayPal();
}

// ─────────────────────────────────────
// SHARED ORDER HANDLERS (used by PayPal + iDEAL)
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

function handleCancel()    { showToast('Payment cancelled. Your cart is still saved.'); }
function handleError(err)  { console.error('Payment error:', err); showToast('Payment error. Please try again or contact support.'); }

// ─────────────────────────────────────
// PAYPAL + iDEAL BUTTONS
// ─────────────────────────────────────
function initPayPal() {
  if (paypalInited) return;
  if (!getCart().length) return;

  const container  = document.getElementById('paypal-button-container');
  const loadingMsg = document.getElementById('paypal-loading-msg');
  if (!container) return;

  if (typeof paypal === 'undefined') return;

  if (loadingMsg) loadingMsg.style.display = 'none';
  paypalInited = true;

  // ── PayPal button ──
  paypal.Buttons({
    style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 50 },
    onClick:      (data, actions) => { if (!validateForm()) return actions.reject(); return actions.resolve(); },
    createOrder:  (data, actions) => buildOrder(actions),
    onApprove:    handleApprove,
    onCancel:     handleCancel,
    onError:      handleError,
  }).render('#paypal-button-container');

  // ── iDEAL button — explicit so it always shows for NL customers ──
  const idealContainer = document.getElementById('ideal-button-container');
  if (idealContainer && paypal.FUNDING) {
    try {
      paypal.Buttons({
        fundingSource: paypal.FUNDING.IDEAL,
        style:        { height: 48, shape: 'rect' },
        onClick:      (data, actions) => { if (!validateForm()) return actions.reject(); return actions.resolve(); },
        createOrder:  (data, actions) => buildOrder(actions),
        onApprove:    handleApprove,
        onCancel:     handleCancel,
        onError:      handleError,
      }).render('#ideal-button-container');
    } catch (e) {
      // iDEAL not available in this PayPal account/region — hide the divider
      const divider = idealContainer.previousElementSibling;
      if (divider) divider.style.display = 'none';
      idealContainer.style.display = 'none';
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
    shippingCost = (radio.value === 'standard' && sub >= FREE_SHIP_THRESHOLD)
      ? 0
      : (SHIPPING_RATES[radio.value] ?? 0);

    const lbl = document.getElementById('shipping-cost-label');
    if (lbl && radio.value === 'standard')
      lbl.textContent = sub >= FREE_SHIP_THRESHOLD ? 'FREE' : fmt(SHIPPING_RATES.standard || 0);

    renderOrderSummary();

    // Re-render PayPal with updated amount
    if (paypalInited) {
      paypalInited = false;
      const c = document.getElementById('paypal-button-container');
      if (c) c.innerHTML = '';
      const msg = document.getElementById('paypal-loading-msg');
      if (msg) msg.style.display = '';
      initPayPal();
    }
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
      if (el?.style) {
        el.style.borderColor = 'var(--red)';
        setTimeout(() => { if (el.style) el.style.borderColor = ''; }, 2500);
      }
      return false;
    }
  }
  const emailEl = document.getElementById('email');
  if (emailEl && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value)) {
    emailEl.focus();
    showToast('Please enter a valid email address.');
    return false;
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
    id:       orderId,
    paypalId: paypalDetails?.id ?? 'PP-' + Date.now(),
    date:     new Date().toISOString(),
    items:    [...cart],
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
    email:         document.getElementById('email')?.value ?? '',
    shippingCost,
    discount,
    subtotal:      getSubtotal(),
    tax:           (getSubtotal() * (1 - discount)) * TAX_RATE,
    total:         getTotal(),
    paymentMethod: 'PayPal',
  };
  localStorage.setItem('zl-last-order', JSON.stringify(order));
  return order;
}

// ─────────────────────────────────────
// INIT — wait for DOM then render
// ─────────────────────────────────────
function init() {
  renderOrderSummary();

  const sub = getSubtotal();
  if (sub >= FREE_SHIP_THRESHOLD) {
    const lbl = document.getElementById('shipping-cost-label');
    if (lbl) lbl.textContent = 'FREE';
  }

  // Poll for PayPal SDK (loaded with defer — arrives after inline scripts)
  if (typeof paypal !== 'undefined') {
    initPayPal();
  } else {
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      if (typeof paypal !== 'undefined') {
        clearInterval(poll);
        initPayPal();
      } else if (attempts >= 25) {           // 10s timeout
        clearInterval(poll);
        const msg = document.getElementById('paypal-loading-msg');
        if (msg) {
          msg.textContent = 'Payment could not load. Please refresh the page.';
          msg.style.color = 'var(--red)';
        }
      }
    }, 400);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
