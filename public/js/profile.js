/**
 * profile.js — Profile page logic.
 */

(function () {
  'use strict';

  function escapeHTML(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function avatarColor(name) {
    const colors = ['#6C63FF','#3ECFCF','#f472b6','#fb923c','#a3e635','#facc15'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  }
  function letterAvatar(username, size = 80) {
    const color = avatarColor(username);
    const initials = username.slice(0,2).toUpperCase();
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:${size*0.35}px;font-weight:700;color:#fff;">${escapeHTML(initials)}</div>`;
  }

  const avatarDisplay  = document.getElementById('profile-avatar-display');
  const avatarInput    = document.getElementById('avatar-input');
  const avatarStatus   = document.getElementById('avatar-status');
  const successDiv     = document.getElementById('profile-success');
  const errorDiv       = document.getElementById('profile-error');
  const saveBtn        = document.getElementById('save-profile-btn');
  const bioInput       = document.getElementById('profile-bio');
  const bioCounter     = document.getElementById('bio-counter');

  let currentUser = null;

  function showAvatar(user) {
    if (user.profilePic) {
      avatarDisplay.innerHTML = `<img src="${escapeHTML(user.profilePic)}" alt="Avatar" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid var(--border);" />`;
    } else {
      avatarDisplay.innerHTML = letterAvatar(user.username, 80);
    }
  }

  function showSuccess(msg) { successDiv.textContent = msg; successDiv.hidden = false; errorDiv.hidden = true; }
  function showError(msg)   { errorDiv.textContent = msg;   errorDiv.hidden = false; successDiv.hidden = true; }
  function clearMessages()  { successDiv.hidden = true; errorDiv.hidden = true; }

  // ── Bio char counter ──────────────────────────────────────────────────────
  bioInput.addEventListener('input', () => {
    const len = bioInput.value.length;
    bioCounter.textContent = `${len} / 150`;
    bioCounter.style.color = len > 140 ? 'var(--status-reconnecting)' : 'var(--text-muted)';
  });

  // ── Avatar file change → instant upload ───────────────────────────────────
  avatarInput.addEventListener('change', async () => {
    const file = avatarInput.files[0];
    if (!file) return;

    // Preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      avatarDisplay.innerHTML = `<img src="${e.target.result}" alt="New avatar preview" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid var(--accent);" />`;
    };
    reader.readAsDataURL(file);

    avatarStatus.textContent = 'Uploading…';

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const data = await API.postForm('/api/profile/avatar', formData);
      currentUser.profilePic = data.profilePic;
      showAvatar(currentUser);
      avatarStatus.textContent = '✓ Avatar updated';
      setTimeout(() => { avatarStatus.textContent = ''; }, 3000);
    } catch (err) {
      avatarStatus.textContent = `✗ ${err.message}`;
      showAvatar(currentUser); // Revert preview
    }
  });

  // ── Save profile text fields ──────────────────────────────────────────────
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const username = document.getElementById('profile-username').value.trim();
    const name     = document.getElementById('profile-name').value.trim();
    const bio      = bioInput.value.trim();

    // Client-side validation
    if (username && !/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      showError('Username: 3–20 characters, letters/numbers/underscores/hyphens only.');
      return;
    }
    if (bio.length > 150) {
      showError('Bio cannot exceed 150 characters.');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      const body = {};
      if (username) body.username = username;
      body.name = name;
      body.bio  = bio;

      const data = await API.put('/api/profile', body);
      currentUser = data.user;
      showSuccess('Profile saved successfully!');
    } catch (err) {
      showError(err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> Save Profile`;
    }
  });

  // ── Sign out ──────────────────────────────────────────────────────────────
  document.getElementById('signout-profile-btn').addEventListener('click', async () => {
    try { await API.post('/api/auth/signout', {}); } catch (_) {}
    window.location.href = '/auth.html';
  });

  // ── Init: load profile data ───────────────────────────────────────────────
  async function init() {
    const user = await API.whoami();
    if (!user) { window.location.href = '/auth.html'; return; }

    currentUser = user;
    showAvatar(user);

    document.getElementById('profile-username').value = user.username || '';
    document.getElementById('profile-name').value     = user.name     || '';
    bioInput.value = user.bio || '';
    bioInput.dispatchEvent(new Event('input')); // Trigger counter
  }

  init();
})();
