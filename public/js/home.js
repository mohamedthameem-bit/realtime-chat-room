/**
 * home.js — Home page logic.
 */

(function () {
  'use strict';

  // Helpers
  function escapeHTML(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getInitials(username) {
    return username ? username.slice(0, 2).toUpperCase() : '??';
  }

  function avatarColor(name) {
    const colors = ['#6C63FF','#3ECFCF','#f472b6','#fb923c','#a3e635','#facc15'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  async function init() {
    const user = await API.whoami();
    if (!user) {
      window.location.href = '/auth.html';
      return;
    }

    // Update greeting
    document.getElementById('home-greeting').textContent = `Welcome back, ${escapeHTML(user.username)}!`;

    // Nav avatar
    const navAvatar = document.getElementById('nav-avatar');
    const navUsername = document.getElementById('nav-username');
    navUsername.textContent = escapeHTML(user.username);

    if (user.profilePic) {
      navAvatar.innerHTML = `<img src="${escapeHTML(user.profilePic)}" alt="${escapeHTML(user.username)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />`;
    } else {
      const color = avatarColor(user.username);
      navAvatar.innerHTML = `<div style="width:32px;height:32px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:#fff;">${escapeHTML(getInitials(user.username))}</div>`;
    }

    // Sign out
    document.getElementById('signout-btn').addEventListener('click', async () => {
      try {
        await API.post('/api/auth/signout', {});
      } catch (_) { /* ignore */ }
      window.location.href = '/auth.html';
    });
  }

  init();
})();
