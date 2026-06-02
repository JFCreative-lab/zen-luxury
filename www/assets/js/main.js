/**
 * ZL · Zen Luxury — Main JavaScript
 */

/* ─────────────────────────────────────
   NAV
───────────────────────────────────── */
const nav        = document.querySelector('.nav');
const hamburger  = document.querySelector('.nav__hamburger');
const mobileMenu = document.querySelector('.nav__mobile');

window.addEventListener('scroll', () => nav?.classList.toggle('scrolled', window.scrollY > 60));

hamburger?.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  mobileMenu?.classList.toggle('open');
  document.body.style.overflow = mobileMenu?.classList.contains('open') ? 'hidden' : '';
});

mobileMenu?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  hamburger?.classList.remove('open');
  mobileMenu.classList.remove('open');
  document.body.style.overflow = '';
}));

// Active nav link
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav__links a, .nav__mobile a').forEach(link => {
  if (link.getAttribute('href') === currentPage) link.classList.add('active');
});

/* ─────────────────────────────────────
   SIZE CHIPS
───────────────────────────────────── */
document.addEventListener('click', e => {
  const chip = e.target.closest('.size-chip');
  if (!chip || chip.classList.contains('sold-out')) return;
  chip.closest('.product-card__sizes')?.querySelectorAll('.size-chip').forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
});

window.getSelectedSize = function(btnEl) {
  const card = btnEl.closest('.product-card');
  return card?.querySelector('.size-chip.selected')?.dataset.size ?? 'M';
};

/* ─────────────────────────────────────
   WISHLIST
───────────────────────────────────── */
let wishlist = JSON.parse(localStorage.getItem('zl-wishlist') || '[]');

window.toggleWishlist = function(btnEl) {
  const card  = btnEl.closest('.product-card');
  const name  = card?.querySelector('.product-card__name')?.textContent?.trim() ?? '';
  if (!name) return;

  const idx = wishlist.indexOf(name);
  if (idx === -1) {
    wishlist.push(name);
    btnEl.querySelector('svg').setAttribute('fill', 'var(--gold)');
    showToast(`${name} added to wishlist`);
  } else {
    wishlist.splice(idx, 1);
    btnEl.querySelector('svg').setAttribute('fill', 'none');
    showToast(`${name} removed from wishlist`);
  }
  localStorage.setItem('zl-wishlist', JSON.stringify(wishlist));
};

// Restore wishlist fill on page load
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.product-card').forEach(card => {
    const name = card.querySelector('.product-card__name')?.textContent?.trim();
    if (name && wishlist.includes(name)) {
      card.querySelector('.product-card__action-btn[title="Wishlist"] svg')
          ?.setAttribute('fill', 'var(--gold)');
    }
  });
});

/* ─────────────────────────────────────
   CART
───────────────────────────────────── */
let cart = JSON.parse(localStorage.getItem('zl-cart') || '[]');

const cartOverlay  = document.querySelector('.cart-overlay');
const cartDrawer   = document.querySelector('.cart-drawer');
const cartCountEl  = document.querySelector('.nav__cart-count');
const cartBodyEl   = document.querySelector('.cart-drawer__body');

function saveCart()  { localStorage.setItem('zl-cart', JSON.stringify(cart)); }

function updateCartUI() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const fmt   = n => '€' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (cartCountEl) {
    cartCountEl.classList.toggle('has-items', count > 0);
    const badge = cartCountEl.querySelector('.badge');
    if (badge) badge.textContent = count;
  }

  const subEl   = document.getElementById('cart-subtotal');
  const totalEl = document.getElementById('cart-total');
  if (subEl)   subEl.textContent   = fmt(total);
  if (totalEl) totalEl.textContent = fmt(total);

  if (!cartBodyEl) return;

  if (!cart.length) {
    cartBodyEl.innerHTML = `
      <div class="cart-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/>
        </svg>
        <p>Your cart is empty</p>
        <a href="shop.html" class="btn btn--outline" style="margin-top:.5rem;font-size:.65rem;">Shop the Drop</a>
      </div>`;
    return;
  }

  cartBodyEl.innerHTML = cart.map((item, i) => `
    <div class="cart-item">
      <img class="cart-item__img" src="${item.image}" alt="${item.name}" loading="lazy"/>
      <div class="cart-item__info">
        <p class="cart-item__name">${item.name}</p>
        <p class="cart-item__variant">Size: ${item.variant || 'M'}</p>
        <p class="cart-item__price">${fmt(item.price * item.qty)}</p>
        <div class="cart-item__qty">
          <button class="cart-item__qty-btn" data-action="dec" data-index="${i}">−</button>
          <span class="cart-item__qty-num">${item.qty}</span>
          <button class="cart-item__qty-btn" data-action="inc" data-index="${i}">+</button>
        </div>
        <button class="cart-item__remove" data-index="${i}">Remove</button>
      </div>
    </div>`).join('');

  cartBodyEl.querySelectorAll('.cart-item__qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.index);
      if (btn.dataset.action === 'inc') {
        cart[idx].qty += 1;
      } else {
        cart[idx].qty -= 1;
        if (cart[idx].qty <= 0) cart.splice(idx, 1);
      }
      saveCart(); updateCartUI();
    });
  });

  cartBodyEl.querySelectorAll('.cart-item__remove').forEach(btn => {
    btn.addEventListener('click', () => { cart.splice(Number(btn.dataset.index), 1); saveCart(); updateCartUI(); });
  });
}

window.addToCart = function(name, price, image, variant = 'M') {
  const existing = cart.find(i => i.name === name && i.variant === variant);
  if (existing) { existing.qty += 1; }
  else { cart.push({ name, price, image, variant, qty: 1 }); }
  saveCart(); updateCartUI();
  showToast(`${name} (${variant}) added to cart`);
};

window.openCart = function() {
  cartOverlay?.classList.add('open');
  cartDrawer?.classList.add('open');
  document.body.style.overflow = 'hidden';
  updateCartUI();
};

window.closeCart = function() {
  cartOverlay?.classList.remove('open');
  cartDrawer?.classList.remove('open');
  document.body.style.overflow = '';
};

document.querySelector('.nav__cart-count')?.addEventListener('click', openCart);
document.querySelector('[tabindex="0"].nav__cart-count')?.addEventListener('keydown', e => { if (e.key === 'Enter') openCart(); });
cartOverlay?.addEventListener('click', closeCart);
document.querySelector('.cart-drawer__close')?.addEventListener('click', closeCart);

/* ─────────────────────────────────────
   TOAST
───────────────────────────────────── */
window.showToast = function(message) {
  const toast = document.querySelector('.toast');
  if (!toast) return;
  toast.querySelector('.toast__message').textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
};

/* ─────────────────────────────────────
   SHOP FILTERS
───────────────────────────────────── */
const filterBtns  = document.querySelectorAll('.filter-btn');
const productCards = document.querySelectorAll('.product-card[data-category]');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    productCards.forEach(card => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.style.opacity = '0';
      card.style.transform = 'translateY(10px)';
      setTimeout(() => {
        card.style.display = match ? '' : 'none';
        if (match) requestAnimationFrame(() => { card.style.opacity='1'; card.style.transform='translateY(0)'; });
      }, 160);
    });
  });
});

/* ─────────────────────────────────────
   SORT
───────────────────────────────────── */
document.querySelector('.sort-select')?.addEventListener('change', e => {
  const grid  = document.querySelector('.products__grid');
  if (!grid) return;
  const cards = [...grid.querySelectorAll('.product-card')];
  cards.sort((a, b) => {
    const pA = parseFloat(a.dataset.price ?? '0');
    const pB = parseFloat(b.dataset.price ?? '0');
    if (e.target.value === 'price-asc')  return pA - pB;
    if (e.target.value === 'price-desc') return pB - pA;
    return 0;
  });
  cards.forEach(c => grid.appendChild(c));
});

/* ─────────────────────────────────────
   SCROLL REVEAL
───────────────────────────────────── */
const revealEls = document.querySelectorAll(
  '.section__header, .product-card, .collection-card, .stat-item, .testimonial-card, .value-item, .about-split__text, .about-split__img, .trust-item'
);
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.07, rootMargin: '0px 0px -40px 0px' });

revealEls.forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity 0.65s ease, transform 0.65s ease';
  observer.observe(el);
});

/* ─────────────────────────────────────
   NEWSLETTER
───────────────────────────────────── */
document.querySelectorAll('.newsletter__form').forEach(form => {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const input = e.target.querySelector('.newsletter__input');
    const email = input?.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Please enter a valid email address.'); return;
    }
    const subs = JSON.parse(localStorage.getItem('zl-newsletter-subs') || '[]');
    if (!subs.includes(email)) { subs.push(email); localStorage.setItem('zl-newsletter-subs', JSON.stringify(subs)); }
    showToast('You\'re in the ZL Circle — welcome!');
    if (input) input.value = '';
  });
});

/* ─────────────────────────────────────
   CONTACT FORM — sends via your email app
───────────────────────────────────── */
document.querySelector('.contact-form')?.addEventListener('submit', function(e) {
  e.preventDefault();
  const form    = e.target;
  const consent = form.querySelector('#consent');
  if (consent && !consent.checked) {
    showToast('Please accept the Privacy Policy to send your message.'); return;
  }
  const name    = `${form.querySelector('#first-name')?.value || ''} ${form.querySelector('#last-name')?.value || ''}`.trim();
  const email   = form.querySelector('#email')?.value || '';
  const subject = form.querySelector('#subject')?.value || 'Contact';
  const message = form.querySelector('#message')?.value || '';
  window.location.href = `mailto:J.ovk.zakelijk@gmail.com?subject=${encodeURIComponent(subject + ' — ' + name)}&body=${encodeURIComponent(message + '\n\nFrom: ' + email)}`;
  showToast('Opening your email app…');
});

/* ─────────────────────────────────────
   PRODUCT ENRICHMENT
   Adds short descriptions + luxury urgency tags to product cards.
───────────────────────────────────── */
const PRODUCT_META = {
  'ZL Oversized Hoodie': {
    desc:  '420gsm heavyweight cotton · Gold embroidery · Relaxed silhouette',
    stock: 'Only 14 left in this drop',
  },
  'ZL Gold Logo Hoodie': {
    desc:  'Chenille ZL logo on chest · 400gsm French terry · Limited production',
    stock: 'Only 8 left · Limited batch',
    hot:   true,
  },
  'ZL Gold Script Tee': {
    desc:  '400gsm ring-spun cotton · Gold foil script · Unisex relaxed fit',
    stock: '22 sold this week',
  },
  'ZL Essential Tee': {
    desc:  '350gsm premium cotton · Minimal ZL branding · Everyday essential',
    stock: 'In stock · Ships same day',
  },
  'ZL Cargo Pants': {
    desc:  'Multi-pocket utility design · French terry · Solid metal hardware',
    stock: 'Only 11 left at this price',
    hot:   true,
  },
  'ZL Track Pants': {
    desc:  'Signature ZL side stripe · Tapered fit · Elastic waistband',
    stock: 'Most popular this week',
  },
  'ZL Satin Bomber': {
    desc:  'Japanese satin shell · Full satin lining · Embroidered ZL patch',
    stock: 'Only 6 left — selling fast',
    hot:   true,
  },
  'ZL Quilted Puffer': {
    desc:  'Japanese ripstop shell · Down-alternative fill · Structured puffer panels',
    stock: 'Last 9 units this season',
  },
  'ZL Snapback Cap': {
    desc:  '6-panel structured cap · ZL gold embroidery · Adjustable snapback',
    stock: 'Ships in 24 hours',
  },
  'ZL Gold Beanie': {
    desc:  'Merino wool blend · Minimal ZL patch · Ribbed fold cuff',
    stock: 'Bestselling accessory',
  },
  'ZL Relaxed Tee': {
    desc:  'Classic oversized drop · Faded-effect wash · Unisex cut',
    stock: 'Final stock · No restock',
    hot:   true,
  },
  'ZL Slim Jogger': {
    desc:  'Tapered slim leg · 300gsm French terry · Side zip pockets',
    stock: 'Final units available',
  },
};

window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.product-card').forEach(card => {
    const nameEl = card.querySelector('.product-card__name');
    const name   = nameEl?.textContent.trim();
    const meta   = name && PRODUCT_META[name];
    if (!meta) return;

    const body   = card.querySelector('.product-card__body');
    const priceEl = card.querySelector('.product-card__price');
    if (!body || !priceEl) return;

    // Description
    const descEl = document.createElement('p');
    descEl.className = 'product-card__desc';
    descEl.textContent = meta.desc;
    body.insertBefore(descEl, priceEl);

    // Urgency tag
    const sizesEl = card.querySelector('.product-card__sizes');
    if (sizesEl && meta.stock) {
      const urgEl = document.createElement('p');
      urgEl.className = 'urgency-tag' + (meta.hot ? ' urgency-tag--hot' : '');
      urgEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:11px;height:11px"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> ${meta.stock}`;
      sizesEl.after(urgEl);
    }
  });
});

/* ─────────────────────────────────────
   INIT
───────────────────────────────────── */
updateCartUI();
