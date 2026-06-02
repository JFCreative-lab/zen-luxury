/**
 * ZL · Zen Luxury — Checkout Logic
 *
 * Payment integrations:
 *  - Stripe  : replace YOUR_STRIPE_PUBLISHABLE_KEY and YOUR_STRIPE_PAYMENT_LINK
 *  - PayPal  : replace YOUR_PAYPAL_CLIENT_ID in checkout.html <script> tag
 *  - Klarna / Apple Pay / Google Pay : activated automatically through Stripe
 */

// ─────────────────────────────────────
// CONFIG — replace these values
// ─────────────────────────────────────
const STRIPE_PUBLISHABLE_KEY  = 'YOUR_STRIPE_PUBLISHABLE_KEY';
const STRIPE_PAYMENT_LINK     = 'YOUR_STRIPE_PAYMENT_LINK'; // e.g. https://buy.stripe.com/xxxx
const PROMO_CODES = {
  'ZL10':  0.10,   // 10% off
  'ZL20':  0.20,   // 20% off
  'ZLVIP': 0.25,   // 25% off — VIP
};
const TAX_RATE    = 0.08;   // 8% estimated tax
const SHIPPING    = { standard: 0, express: 12, overnight: 28 };
const FREE_SHIP_THRESHOLD = 150;

// ─────────────────────────────────────
// STATE
// ─────────────────────────────────────
let cart         = JSON.parse(localStorage.getItem('zl-cart') || '[]');
let discount     = 0;       // fraction, e.g. 0.10
let shippingCost = 0;
let activePaymentPanel = 'card';

// ─────────────────────────────────────
// ORDER SUMMARY
// ─────────────────────────────────────
function getSubtotal() {
  return cart.reduce((s, i) => s + i.price * i.qty, 0);
}

function getTotal() {
  const sub  = getSubtotal();
  const disc = sub * discount;
  const tax  = (sub - disc) * TAX_RATE;
  return sub - disc + tax + shippingCost;
}

function fmt(n) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function renderOrderSummary() {
  const itemsEl    = document.getElementById('order-items');
  const totalsEl   = document.getElementById('order-totals');
  const amountEl   = document.getElementById('stripe-amount');

  if (!cart.length) {
    if (itemsEl) itemsEl.innerHTML = `
      <div style="text-align:center;padding:2rem 0;">
        <p style="color:var(--grey);font-size:.83rem;">Your cart is empty</p>
        <a href="shop.html" class="btn btn--outline" style="margin-top:1rem;font-size:.65rem;">Shop Now</a>
      </div>`;
    if (totalsEl) totalsEl.style.display = 'none';
    return;
  }

  // Items
  if (itemsEl) {
    itemsEl.innerHTML = cart.map(item => `
      <div class="order-item">
        <img class="order-item__img" src="${item.image}" alt="${item.name}" loading="lazy"/>
        <div class="order-item__info">
          <p class="order-item__name">${item.name}</p>
          <p class="order-item__variant">${item.variant || 'One Size'} · Qty ${item.qty}</p>
          <p class="order-item__price">${fmt(item.price * item.qty)}</p>
        </div>
      </div>`).join('');
  }

  // Totals
  if (totalsEl) {
    totalsEl.style.display = '';
    const sub  = getSubtotal();
    const disc = sub * discount;
    const tax  = (sub - disc) * TAX_RATE;
    const total = sub - disc + tax + shippingCost;

    document.getElementById('ot-subtotal').textContent = fmt(sub);
    document.getElementById('ot-shipping').textContent = shippingCost === 0 ? 'Free' : fmt(shippingCost);
    document.getElementById('ot-tax').textContent      = fmt(tax);
    document.getElementById('ot-total').textContent    = fmt(total);
    if (amountEl) amountEl.textContent = fmt(total);
  }
}

// ─────────────────────────────────────
// SHIPPING SELECTION
// ─────────────────────────────────────
document.querySelectorAll('input[name="shipping"]').forEach(radio => {
  radio.addEventListener('change', () => {
    document.querySelectorAll('.payment-method').forEach(m => {
      if (m.querySelector('input[name="shipping"]')) m.classList.remove('selected');
    });
    radio.closest('.payment-method').classList.add('selected');
    shippingCost = getSubtotal() >= FREE_SHIP_THRESHOLD && radio.value === 'standard'
      ? 0
      : SHIPPING[radio.value] ?? 0;
    // Show "FREE" label for standard if eligible
    const lbl = document.getElementById('shipping-cost-label');
    if (lbl && radio.value === 'standard') {
      lbl.textContent = getSubtotal() >= FREE_SHIP_THRESHOLD ? 'FREE' : fmt(SHIPPING.standard || 0);
    }
    renderOrderSummary();
  });
});

// ─────────────────────────────────────
// PAYMENT PANEL SWITCHING
// ─────────────────────────────────────
window.showPaymentPanel = function(panel) {
  activePaymentPanel = panel;

  // Update selected state on payment method labels
  document.querySelectorAll('#payment-methods .payment-method').forEach(m => m.classList.remove('selected'));
  const pmEl = document.getElementById('pm-' + panel);
  if (pmEl) pmEl.classList.add('selected');

  // Show/hide panels
  ['card', 'paypal', 'apple', 'google', 'klarna'].forEach(p => {
    const el = document.getElementById('panel-' + p);
    if (el) el.style.display = p === panel ? '' : 'none';
  });

  if (panel === 'paypal') initPayPal();
};

// ─────────────────────────────────────
// PROMO CODE
// ─────────────────────────────────────
window.applyPromo = function() {
  const code = (document.getElementById('promo-input')?.value || '').trim().toUpperCase();
  const msg  = document.getElementById('promo-msg');
  if (PROMO_CODES[code] !== undefined) {
    discount = PROMO_CODES[code];
    if (msg) { msg.textContent = `✓ Code applied — ${Math.round(discount * 100)}% off`; msg.style.color = 'var(--gold)'; }
  } else {
    discount = 0;
    if (msg) { msg.textContent = 'Invalid promo code.'; msg.style.color = '#c0392b'; }
  }
  renderOrderSummary();
};

// ─────────────────────────────────────
// STRIPE
// ─────────────────────────────────────
window.handleStripeCheckout = function() {
  if (!validateForm()) return;

  if (STRIPE_PAYMENT_LINK === 'YOUR_STRIPE_PAYMENT_LINK') {
    showToast('Configure STRIPE_PAYMENT_LINK in checkout.js to activate payments');
    return;
  }

  // Redirect to Stripe Payment Link (simplest hosted checkout)
  window.location.href = STRIPE_PAYMENT_LINK;
};

// Format card number as user types
const cardNumberInput = document.getElementById('card-number');
cardNumberInput?.addEventListener('input', e => {
  let v = e.target.value.replace(/\D/g, '').substring(0, 16);
  e.target.value = v.match(/.{1,4}/g)?.join(' ') ?? v;
});

// Format expiry
const cardExpiryInput = document.getElementById('card-expiry');
cardExpiryInput?.addEventListener('input', e => {
  let v = e.target.value.replace(/\D/g, '').substring(0, 4);
  if (v.length >= 3) v = v.substring(0, 2) + ' / ' + v.substring(2);
  e.target.value = v;
});

// ─────────────────────────────────────
// PAYPAL
// ─────────────────────────────────────
let paypalRendered = false;

function initPayPal() {
  if (paypalRendered) return;
  const container = document.getElementById('paypal-button-container');
  if (!container) return;

  if (typeof paypal === 'undefined') {
    container.innerHTML = '<p style="color:var(--grey);font-size:.75rem;">PayPal SDK not loaded. Replace YOUR_PAYPAL_CLIENT_ID in checkout.html.</p>';
    return;
  }

  paypalRendered = true;

  paypal.Buttons({
    style: {
      layout: 'vertical',
      color:  'gold',
      shape:  'rect',
      label:  'paypal',
      height: 46,
    },
    createOrder: (data, actions) => {
      const total = getTotal();
      return actions.order.create({
        purchase_units: [{
          amount: {
            value: total.toFixed(2),
            currency_code: 'USD',
          },
          description: 'ZL · Zen Luxury Order',
        }],
        application_context: { shipping_preference: 'NO_SHIPPING' },
      });
    },
    onApprove: (data, actions) => {
      return actions.order.capture().then(details => {
        const name = details.payer?.name?.given_name ?? 'friend';
        showToast(`Payment confirmed — thank you, ${name}!`);
        // Clear cart and redirect to a confirmation page
        localStorage.removeItem('zl-cart');
        setTimeout(() => { window.location.href = 'index.html'; }, 2500);
      });
    },
    onError: err => {
      console.error('PayPal error:', err);
      showToast('PayPal encountered an error. Please try again.');
    },
  }).render('#paypal-button-container');
}

// ─────────────────────────────────────
// FORM VALIDATION
// ─────────────────────────────────────
function validateForm() {
  const required = ['email', 'first-name', 'last-name', 'address', 'city', 'zip'];
  for (const id of required) {
    const el = document.getElementById(id);
    if (!el?.value.trim()) {
      el?.focus();
      showToast('Please fill in all required fields');
      el?.style && (el.style.borderColor = 'var(--red)');
      setTimeout(() => { if (el?.style) el.style.borderColor = ''; }, 2000);
      return false;
    }
  }
  return true;
}

// ─────────────────────────────────────
// INIT
// ─────────────────────────────────────
renderOrderSummary();
// Set initial shipping cost check
if (getSubtotal() >= FREE_SHIP_THRESHOLD) {
  const lbl = document.getElementById('shipping-cost-label');
  if (lbl) lbl.textContent = 'FREE';
}
