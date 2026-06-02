/**
 * ZL · Zen Luxury — Checkout Logic
 *
 * Payment: PayPal Smart Buttons
 *  - Accepts Visa, Mastercard, Amex, Discover, PayPal, Venmo
 *  - No Stripe required — PayPal handles all cards natively
 *
 * SETUP: Replace YOUR_PAYPAL_CLIENT_ID in checkout.html with your
 * Live PayPal Client ID from developer.paypal.com
 */

// ─────────────────────────────────────
// CONFIG
// ─────────────────────────────────────
const PROMO_CODES = {
  'ZL10':  0.10,   // 10% off
  'ZL20':  0.20,   // 20% off
  'ZLVIP': 0.25,   // 25% off — VIP
};
const TAX_RATE             = 0.08;   // 8% estimated tax
const SHIPPING             = { standard: 0, express: 12, overnight: 28 };
const FREE_SHIP_THRESHOLD  = 150;

// ─────────────────────────────────────
// STATE
// ─────────────────────────────────────
let cart         = JSON.parse(localStorage.getItem('zl-cart') || '[]');
let discount     = 0;
let shippingCost = 0;

// ─────────────────────────────────────
// MATH
// ─────────────────────────────────────
function getSubtotal() {
  return cart.reduce((s, i) => s + i.price * i.qty, 0);
}

function getTotal() {
  const sub  = getSubtotal();
  const disc = sub * discount;
  return (sub - disc) * (1 + TAX_RATE) + shippingCost;
}

function fmt(n) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ─────────────────────────────────────
// ORDER SUMMARY RENDER
// ─────────────────────────────────────
function renderOrderSummary() {
  const itemsEl  = document.getElementById('order-items');
  const totalsEl = document.getElementById('order-totals');

  if (!cart.length) {
    if (itemsEl) itemsEl.innerHTML = `
      <div style="text-align:center;padding:2rem 0;">
        <p style="color:var(--grey);font-size:.83rem;">Your cart is empty</p>
        <a href="shop.html" class="btn btn--outline" style="margin-top:1rem;font-size:.65rem;">Shop Now</a>
      </div>`;
    if (totalsEl) totalsEl.style.display = 'none';
    return;
  }

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

  if (totalsEl) {
    totalsEl.style.display = '';
    const sub   = getSubtotal();
    const disc  = sub * discount;
    const tax   = (sub - disc) * TAX_RATE;
    const total = sub - disc + tax + shippingCost;

    document.getElementById('ot-subtotal').textContent = fmt(sub);
    document.getElementById('ot-shipping').textContent = shippingCost === 0 ? 'Free' : fmt(shippingCost);
    document.getElementById('ot-tax').textContent      = fmt(tax);
    document.getElementById('ot-total').textContent    = fmt(total);

    const discRow = document.getElementById('ot-discount-row');
    const discEl  = document.getElementById('ot-discount');
    if (discRow && discEl) {
      if (discount > 0) {
        discEl.textContent = `-${fmt(disc)} (${Math.round(discount * 100)}% off)`;
        discRow.style.display = '';
      } else {
        discRow.style.display = 'none';
      }
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
    if (radio.value === 'standard' && sub >= FREE_SHIP_THRESHOLD) {
      shippingCost = 0;
    } else {
      shippingCost = SHIPPING[radio.value] ?? 0;
    }

    const lbl = document.getElementById('shipping-cost-label');
    if (lbl && radio.value === 'standard') {
      lbl.textContent = sub >= FREE_SHIP_THRESHOLD ? 'FREE' : fmt(SHIPPING.standard || 0);
    }
    renderOrderSummary();
    // Re-render PayPal with updated total
    if (paypalRendered) {
      paypalRendered = false;
      const container = document.getElementById('paypal-button-container');
      if (container) container.innerHTML = '';
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
      if (el?.style) { el.style.borderColor = 'var(--red)'; setTimeout(() => { if (el.style) el.style.borderColor = ''; }, 2500); }
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
// SAVE ORDER TO LOCALSTORAGE
// (so order-confirm.html can display it)
// ─────────────────────────────────────
function saveOrder(paypalDetails) {
  const orderId = 'ZL-' + Date.now().toString(36).toUpperCase();
  const order = {
    id:       orderId,
    paypalId: paypalDetails?.id ?? 'PP-' + Date.now(),
    date:     new Date().toISOString(),
    items:    [...cart],
    shipping: {
      firstName: document.getElementById('first-name')?.value ?? '',
      lastName:  document.getElementById('last-name')?.value ?? '',
      address:   document.getElementById('address')?.value ?? '',
      address2:  document.getElementById('address2')?.value ?? '',
      city:      document.getElementById('city')?.value ?? '',
      state:     document.getElementById('state')?.value ?? '',
      zip:       document.getElementById('zip')?.value ?? '',
      country:   document.getElementById('country')?.value ?? '',
      phone:     document.getElementById('phone')?.value ?? '',
    },
    email:        document.getElementById('email')?.value ?? '',
    shippingCost,
    discount,
    subtotal:     getSubtotal(),
    tax:          (getSubtotal() - getSubtotal() * discount) * TAX_RATE,
    total:        getTotal(),
    paymentMethod: 'PayPal',
  };
  localStorage.setItem('zl-last-order', JSON.stringify(order));
  return order;
}

// ─────────────────────────────────────
// PAYPAL INTEGRATION
// ─────────────────────────────────────
let paypalRendered = false;

function initPayPal() {
  if (paypalRendered || !cart.length) return;

  const container = document.getElementById('paypal-button-container');
  const loadingMsg = document.getElementById('paypal-loading-msg');
  const setupNotice = document.getElementById('paypal-setup-notice');

  if (!container) return;

  // Check if PayPal SDK loaded correctly (i.e. client-id was provided)
  if (typeof paypal === 'undefined') {
    if (loadingMsg) loadingMsg.style.display = 'none';
    if (setupNotice) setupNotice.style.display = 'block';
    return;
  }

  if (loadingMsg) loadingMsg.style.display = 'none';
  paypalRendered = true;

  paypal.Buttons({
    style: {
      layout: 'vertical',
      color:  'gold',
      shape:  'rect',
      label:  'pay',
      height: 50,
    },

    // Called when PayPal button is clicked — validate form first
    onClick: (data, actions) => {
      if (!validateForm()) return actions.reject();
      return actions.resolve();
    },

    // Create the PayPal order
    createOrder: (data, actions) => {
      const total = getTotal();
      return actions.order.create({
        purchase_units: [{
          reference_id: 'ZL-ORDER',
          description:  'ZL · Zen Luxury Order',
          amount: {
            value:         total.toFixed(2),
            currency_code: 'USD',
            breakdown: {
              item_total:    { value: (getSubtotal() * (1 - discount)).toFixed(2), currency_code: 'USD' },
              tax_total:     { value: ((getSubtotal() * (1 - discount)) * TAX_RATE).toFixed(2), currency_code: 'USD' },
              shipping:      { value: shippingCost.toFixed(2), currency_code: 'USD' },
            },
          },
          items: cart.map(item => ({
            name:       item.name,
            unit_amount: { value: item.price.toFixed(2), currency_code: 'USD' },
            quantity:   String(item.qty),
            description: `Size: ${item.variant || 'One Size'}`,
            category:   'PHYSICAL_GOODS',
          })),
          shipping: {
            address: {
              address_line_1: document.getElementById('address')?.value ?? '',
              address_line_2: document.getElementById('address2')?.value ?? '',
              admin_area_2:   document.getElementById('city')?.value ?? '',
              admin_area_1:   document.getElementById('state')?.value ?? '',
              postal_code:    document.getElementById('zip')?.value ?? '',
              country_code:   document.getElementById('country')?.value ?? 'US',
            },
          },
        }],
        application_context: {
          brand_name:  'Zen Luxury Worldwide',
          user_action: 'PAY_NOW',
        },
      });
    },

    // Payment approved — capture and confirm
    onApprove: (data, actions) => {
      return actions.order.capture().then(details => {
        saveOrder(details);
        localStorage.removeItem('zl-cart');
        showToast('Payment confirmed — thank you!');
        setTimeout(() => { window.location.href = 'order-confirm.html'; }, 800);
      });
    },

    onCancel: () => {
      showToast('Payment cancelled. Your cart is still saved.');
    },

    onError: err => {
      console.error('PayPal error:', err);
      showToast('Payment error. Please try again or contact support.');
    },

  }).render('#paypal-button-container');
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

// Init PayPal after DOM + SDK ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPayPal);
} else {
  // SDK might still be loading (defer); retry
  const tryInit = setInterval(() => {
    if (typeof paypal !== 'undefined' || document.getElementById('paypal-button-container')?.childElementCount > 0) {
      clearInterval(tryInit);
    }
    initPayPal();
  }, 400);
  setTimeout(() => {
    clearInterval(tryInit);
    // If PayPal still not loaded, show setup notice
    const msg = document.getElementById('paypal-loading-msg');
    if (msg && msg.style.display !== 'none') {
      msg.style.display = 'none';
      const notice = document.getElementById('paypal-setup-notice');
      if (notice) notice.style.display = 'block';
    }
  }, 5000);
}
