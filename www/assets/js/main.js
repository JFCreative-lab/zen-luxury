/**
 * Zen Luxury — Main JavaScript
 * Handles navigation, cart, product interactions, and UI animations.
 */

/* ─────────────────────────────────────
   NAVIGATION
───────────────────────────────────── */
const nav = document.querySelector('.nav');
const hamburger = document.querySelector('.nav__hamburger');
const mobileMenu = document.querySelector('.nav__mobile');

// Scroll: add .scrolled class
window.addEventListener('scroll', () => {
  nav?.classList.toggle('scrolled', window.scrollY > 60);
});

// Hamburger toggle
hamburger?.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  mobileMenu?.classList.toggle('open');
  document.body.style.overflow = mobileMenu?.classList.contains('open') ? 'hidden' : '';
});

// Close mobile menu on link click
mobileMenu?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger?.classList.remove('open');
    mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
  });
});

// Active nav link based on current page
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav__links a, .nav__mobile a').forEach(link => {
  const href = link.getAttribute('href');
  if (href === currentPage || (currentPage === '' && href === 'index.html')) {
    link.classList.add('active');
  }
});

/* ─────────────────────────────────────
   CART
───────────────────────────────────── */
let cart = JSON.parse(localStorage.getItem('zl-cart') || '[]');

const cartOverlay   = document.querySelector('.cart-overlay');
const cartDrawer    = document.querySelector('.cart-drawer');
const cartCountEl   = document.querySelector('.nav__cart-count');
const cartBodyEl    = document.querySelector('.cart-drawer__body');
const cartTotalEl   = document.querySelector('.cart-drawer__total strong');

function saveCart() {
  localStorage.setItem('zl-cart', JSON.stringify(cart));
}

function updateCartUI() {
  const count = cart.reduce((sum, item) => sum + item.qty, 0);

  // Badge
  if (cartCountEl) {
    cartCountEl.classList.toggle('has-items', count > 0);
    const badge = cartCountEl.querySelector('.badge');
    if (badge) badge.textContent = count;
  }

  // Total
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  if (cartTotalEl) cartTotalEl.textContent = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  // Body
  if (!cartBodyEl) return;

  if (cart.length === 0) {
    cartBodyEl.innerHTML = `
      <div class="cart-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/>
        </svg>
        <p>Your cart is empty</p>
        <a href="shop.html" class="btn btn--outline" style="margin-top:.5rem">Shop Now</a>
      </div>`;
    return;
  }

  cartBodyEl.innerHTML = cart.map((item, i) => `
    <div class="cart-item">
      <img class="cart-item__img" src="${item.image}" alt="${item.name}" loading="lazy"/>
      <div class="cart-item__info">
        <p class="cart-item__name">${item.name}</p>
        <p class="cart-item__variant">${item.variant || 'One Size'} · Qty ${item.qty}</p>
        <p class="cart-item__price">$${(item.price * item.qty).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        <button class="cart-item__remove" data-index="${i}">Remove</button>
      </div>
    </div>`).join('');

  cartBodyEl.querySelectorAll('.cart-item__remove').forEach(btn => {
    btn.addEventListener('click', () => {
      cart.splice(Number(btn.dataset.index), 1);
      saveCart();
      updateCartUI();
    });
  });
}

function openCart() {
  cartOverlay?.classList.add('open');
  cartDrawer?.classList.add('open');
  document.body.style.overflow = 'hidden';
  updateCartUI();
}

function closeCart() {
  cartOverlay?.classList.remove('open');
  cartDrawer?.classList.remove('open');
  document.body.style.overflow = '';
}

// Open/close bindings
document.querySelector('.nav__cart-count')?.addEventListener('click', openCart);
cartOverlay?.addEventListener('click', closeCart);
document.querySelector('.cart-drawer__close')?.addEventListener('click', closeCart);

// Checkout button (demo)
document.querySelector('.cart-checkout-btn')?.addEventListener('click', () => {
  if (cart.length === 0) return;
  showToast('Redirecting to checkout…');
  setTimeout(() => {
    cart = [];
    saveCart();
    updateCartUI();
    closeCart();
  }, 2000);
});

// Add to cart (called from product cards)
window.addToCart = function(name, price, image, variant = '') {
  const existing = cart.find(i => i.name === name && i.variant === variant);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ name, price, image, variant, qty: 1 });
  }
  saveCart();
  updateCartUI();
  showToast(`${name} added to cart`);
};

/* ─────────────────────────────────────
   TOAST
───────────────────────────────────── */
function showToast(message) {
  const toast = document.querySelector('.toast');
  if (!toast) return;
  toast.querySelector('.toast__message').textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ─────────────────────────────────────
   SHOP PAGE — FILTER
───────────────────────────────────── */
const filterBtns = document.querySelectorAll('.filter-btn');
const productCards = document.querySelectorAll('.product-card[data-category]');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter;
    productCards.forEach(card => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.style.opacity = '0';
      card.style.transform = 'translateY(12px)';
      setTimeout(() => {
        card.style.display = match ? '' : 'none';
        if (match) {
          requestAnimationFrame(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          });
        }
      }, 180);
    });
  });
});

/* ─────────────────────────────────────
   SORT SELECT
───────────────────────────────────── */
const sortSelect = document.querySelector('.sort-select');
sortSelect?.addEventListener('change', () => {
  const grid = document.querySelector('.products__grid');
  if (!grid) return;
  const cards = [...grid.querySelectorAll('.product-card')];

  cards.sort((a, b) => {
    const pA = parseFloat(a.dataset.price || '0');
    const pB = parseFloat(b.dataset.price || '0');
    if (sortSelect.value === 'price-asc') return pA - pB;
    if (sortSelect.value === 'price-desc') return pB - pA;
    return 0;
  });

  cards.forEach(c => grid.appendChild(c));
});

/* ─────────────────────────────────────
   SCROLL ANIMATIONS (Intersection Observer)
───────────────────────────────────── */
const revealEls = document.querySelectorAll(
  '.section__header, .product-card, .collection-card, .stat-item, .testimonial-card, .value-item, .about-split__text, .about-split__img'
);

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

revealEls.forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(28px)';
  el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
  observer.observe(el);
});

/* ─────────────────────────────────────
   NEWSLETTER FORM
───────────────────────────────────── */
document.querySelector('.newsletter__form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = e.target.querySelector('.newsletter__input');
  if (input?.value) {
    showToast('Thank you for subscribing!');
    input.value = '';
  }
});

/* ─────────────────────────────────────
   CONTACT FORM
───────────────────────────────────── */
document.querySelector('.contact-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  showToast('Message sent — we\'ll be in touch soon.');
  e.target.reset();
});

/* ─────────────────────────────────────
   INIT
───────────────────────────────────── */
updateCartUI();
