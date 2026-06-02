/**
 * ZL · Zen Luxury — Auth Logic
 *
 * Uses localStorage for client-side account management so the site works
 * on GitHub Pages without a backend.
 *
 * PRODUCTION UPGRADE: Replace this with Firebase Authentication or Supabase
 * Auth for real server-side security, social login, and password recovery.
 *   Firebase: https://firebase.google.com/docs/auth/web/start
 *   Supabase: https://supabase.com/docs/guides/auth
 */

// ─────────────────────────────────────
// STORAGE KEYS
// ─────────────────────────────────────
const ACCOUNTS_KEY = 'zl-accounts';
const SESSION_KEY  = 'zl-session';

// ─────────────────────────────────────
// HELPERS
// ─────────────────────────────────────

/** Encode password — not cryptographic; upgrade to hashed backend in production. */
function encodePassword(pw) {
  return btoa(unescape(encodeURIComponent(pw)));
}

function decodePassword(encoded) {
  try { return decodeURIComponent(escape(atob(encoded))); } catch { return ''; }
}

/** Load all stored accounts. */
function getAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]'); } catch { return []; }
}

/** Persist accounts list. */
function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

/**
 * Get the current session object or null.
 * Checks sessionStorage first (no "remember me"), then localStorage.
 */
function getSession() {
  try {
    const s = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

/** Create a new session. */
function createSession(user, remember = false) {
  const session = { id: user.id, email: user.email, name: user.firstName, fullName: `${user.firstName} ${user.lastName}` };
  const store = remember ? localStorage : sessionStorage;
  store.setItem(SESSION_KEY, JSON.stringify(session));
  // If not remembering, clear any old persistent session
  if (!remember) localStorage.removeItem(SESSION_KEY);
}

/** Destroy the current session. */
function destroySession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

/** Expose the current user globally for use in other scripts. */
window.getCurrentUser = getSession;

/** Redirect to auth page if not logged in. */
window.requireAuth = function() {
  if (!getSession()) { window.location.href = 'auth.html'; }
};

// ─────────────────────────────────────
// INIT — update nav if already logged in
// ─────────────────────────────────────
(function initAuthNav() {
  const session = getSession();

  // Desktop nav slot
  const container = document.getElementById('auth-nav-slot');
  if (container) {
    if (session) {
      container.innerHTML = `
        <div class="nav__user">
          <span class="nav__user-name">${session.name}</span>
          <button class="nav__user-logout" onclick="zlLogout()">Log out</button>
        </div>`;
    } else {
      container.innerHTML = `<a href="auth.html" class="nav__account-link" title="My Account">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:20px;height:20px;">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </a>`;
    }
  }

  // Mobile nav — inject Account link
  const mobileNav = document.querySelector('.nav__mobile');
  if (mobileNav) {
    const existing = mobileNav.querySelector('[data-auth-link]');
    if (!existing) {
      const link = document.createElement('a');
      link.dataset.authLink = '1';
      if (session) {
        link.href = '#';
        link.textContent = `Log Out (${session.name})`;
        link.addEventListener('click', e => { e.preventDefault(); zlLogout(); });
      } else {
        link.href = 'auth.html';
        link.textContent = 'Account';
      }
      mobileNav.appendChild(link);
    }
  }
})();

/** Global logout function, called from nav. */
window.zlLogout = function() {
  destroySession();
  showToast('Signed out. See you next time.');
  setTimeout(() => { window.location.href = 'index.html'; }, 1200);
};

// ─────────────────────────────────────
// AUTH PAGE — only runs on auth.html
// ─────────────────────────────────────
const loginPanel    = document.getElementById('panel-login');
const registerPanel = document.getElementById('panel-register');
if (loginPanel && registerPanel) {

  // If already logged in, redirect home
  if (getSession()) { window.location.href = 'index.html'; }

  // ── Tab switching ──
  window.switchTab = function(tab) {
    const isLogin = tab === 'login';

    document.getElementById('tab-login').classList.toggle('active', isLogin);
    document.getElementById('tab-register').classList.toggle('active', !isLogin);
    document.getElementById('tab-login').setAttribute('aria-selected', String(isLogin));
    document.getElementById('tab-register').setAttribute('aria-selected', String(!isLogin));

    loginPanel.hidden    = !isLogin;
    registerPanel.hidden = isLogin;

    // Clear errors
    clearError('login-error');
    clearError('reg-error');
  };

  // ── Password visibility toggle ──
  window.togglePw = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.style.color = isText ? '' : 'var(--gold)';
  };

  // ── Forgot password ──
  window.handleForgot = function(e) {
    e.preventDefault();
    const email = document.getElementById('login-email')?.value.trim();
    if (!email) {
      showToast('Enter your email address first, then click Forgot.');
      document.getElementById('login-email')?.focus();
      return;
    }
    // In production: trigger Firebase sendPasswordResetEmail(auth, email)
    showToast(`If an account exists for ${email}, a reset link will be sent.`);
  };

  // ── Password strength ──
  document.getElementById('reg-password')?.addEventListener('input', function() {
    const val = this.value;
    const bar = document.getElementById('pw-strength');
    if (!bar) return;

    let score = 0;
    if (val.length >= 8)  score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['', '#c0392b', '#e67e22', '#f1c40f', '#27ae60'];
    bar.innerHTML = score > 0 ? `
      <div class="auth-strength__bar" style="width:${score * 25}%;background:${colors[score]};"></div>
      <span style="color:${colors[score]}">${labels[score]}</span>` : '';
  });

  // ── Error helpers ──
  function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }
  function clearError(id) {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  }

  // ── LOGIN ──
  document.getElementById('form-login')?.addEventListener('submit', function(e) {
    e.preventDefault();
    clearError('login-error');

    const email    = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('remember-me')?.checked ?? false;

    if (!email || !password) {
      showError('login-error', 'Please fill in all fields.');
      return;
    }

    const accounts = getAccounts();
    const user = accounts.find(a => a.email === email);

    if (!user || decodePassword(user.password) !== password) {
      showError('login-error', 'Incorrect email or password. Please try again.');
      return;
    }

    createSession(user, remember);

    // Update nav immediately before redirect
    showToast(`Welcome back, ${user.firstName}!`);
    setTimeout(() => {
      const redirect = new URLSearchParams(window.location.search).get('next') || 'index.html';
      window.location.href = redirect;
    }, 900);
  });

  // ── REGISTER ──
  document.getElementById('form-register')?.addEventListener('submit', function(e) {
    e.preventDefault();
    clearError('reg-error');

    const firstName = document.getElementById('reg-first').value.trim();
    const lastName  = document.getElementById('reg-last').value.trim();
    const email     = document.getElementById('reg-email').value.trim().toLowerCase();
    const password  = document.getElementById('reg-password').value;
    const confirm   = document.getElementById('reg-confirm').value;
    const terms     = document.getElementById('terms-check')?.checked;

    // Validate
    if (!firstName || !lastName || !email || !password || !confirm) {
      showError('reg-error', 'Please fill in all required fields.'); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('reg-error', 'Please enter a valid email address.'); return;
    }
    if (password.length < 8) {
      showError('reg-error', 'Password must be at least 8 characters.'); return;
    }
    if (password !== confirm) {
      showError('reg-error', 'Passwords do not match.'); return;
    }
    if (!terms) {
      showError('reg-error', 'Please accept the Terms of Use to continue.'); return;
    }

    const accounts = getAccounts();
    if (accounts.find(a => a.email === email)) {
      showError('reg-error', 'An account with this email already exists.'); return;
    }

    const newUser = {
      id:        `zl_${Date.now()}`,
      email,
      password:  encodePassword(password),
      firstName,
      lastName,
      createdAt: new Date().toISOString(),
      newsletter: document.getElementById('news-check')?.checked ?? false,
    };

    accounts.push(newUser);
    saveAccounts(accounts);
    createSession(newUser, true);

    showToast(`Welcome to ZL, ${firstName}! Your account is ready.`);
    setTimeout(() => {
      const redirect = new URLSearchParams(window.location.search).get('next') || 'index.html';
      window.location.href = redirect;
    }, 900);
  });

} // end auth page block
