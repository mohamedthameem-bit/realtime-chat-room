/**
 * auth.js — Sign In / Sign Up page logic.
 */

(function () {
  'use strict';

  // Redirect to home if already signed in
  API.whoami().then((user) => {
    if (user) window.location.href = '/home.html';
  });

  // ── Validation patterns (mirror server) ──────────────────────────────────
  const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

  // ── Tab switching ─────────────────────────────────────────────────────────
  const tabSignin  = document.getElementById('tab-signin');
  const tabSignup  = document.getElementById('tab-signup');
  const panelSignin = document.getElementById('panel-signin');
  const panelSignup = document.getElementById('panel-signup');

  function switchTab(active) {
    const isSignin = active === 'signin';
    tabSignin.classList.toggle('auth-tab--active', isSignin);
    tabSignup.classList.toggle('auth-tab--active', !isSignin);
    tabSignin.setAttribute('aria-selected', isSignin);
    tabSignup.setAttribute('aria-selected', !isSignin);
    panelSignin.classList.toggle('auth-panel--active', isSignin);
    panelSignup.classList.toggle('auth-panel--active', !isSignin);
    panelSignin.hidden = !isSignin;
    panelSignup.hidden = isSignin;

    // Move the sliding indicator
    const indicator = document.querySelector('.auth-tab-indicator');
    indicator.style.transform = isSignin ? 'translateX(0)' : 'translateX(100%)';
  }

  tabSignin.addEventListener('click', () => switchTab('signin'));
  tabSignup.addEventListener('click', () => switchTab('signup'));

  // ── Password reveal buttons ───────────────────────────────────────────────
  document.querySelectorAll('.input-reveal-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
    });
  });

  // ── Error helpers ─────────────────────────────────────────────────────────
  function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.hidden = false;
  }
  function clearError(id) {
    const el = document.getElementById(id);
    el.hidden = true;
    el.textContent = '';
  }
  function setLoading(btnId, loading, label) {
    const btn = document.getElementById(btnId);
    btn.disabled = loading;
    btn.textContent = loading ? '…' : label;
  }

  // ── Password strength indicator ───────────────────────────────────────────
  const signupPasswordInput = document.getElementById('signup-password');
  const strengthBar = document.getElementById('strength-bar');

  function getStrength(pwd) {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    return score; // 0–5
  }

  signupPasswordInput.addEventListener('input', () => {
    const score = getStrength(signupPasswordInput.value);
    const pct = (score / 5) * 100;
    const colors = ['', '#f87171', '#fb923c', '#fbbf24', '#4ade80', '#22c55e'];
    strengthBar.style.width = `${pct}%`;
    strengthBar.style.background = colors[score] || 'transparent';
  });

  // ── Sign In ───────────────────────────────────────────────────────────────
  document.getElementById('signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError('signin-error');

    const username = document.getElementById('signin-username').value.trim();
    const password = document.getElementById('signin-password').value;

    if (!username || !password) {
      showError('signin-error', 'Please fill in all fields.');
      return;
    }

    setLoading('signin-btn', true, 'Sign In');
    try {
      await API.post('/api/auth/signin', { username, password });
      window.location.href = '/home.html';
    } catch (err) {
      showError('signin-error', err.message);
      setLoading('signin-btn', false, 'Sign In');
    }
  });

  // ── Sign Up ───────────────────────────────────────────────────────────────
  document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError('signup-error');

    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;

    // Client-side validation
    if (!USERNAME_REGEX.test(username)) {
      showError('signup-error', 'Username: 3–20 characters, letters/numbers/underscores/hyphens only.');
      return;
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      showError('signup-error', 'Password must be at least 8 characters with at least one letter and one number.');
      return;
    }

    setLoading('signup-btn', true, 'Create Account');
    try {
      await API.post('/api/auth/signup', { username, password });
      window.location.href = '/home.html';
    } catch (err) {
      showError('signup-error', err.message);
      setLoading('signup-btn', false, 'Create Account');
    }
  });
})();
