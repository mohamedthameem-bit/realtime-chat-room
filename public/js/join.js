/**
 * join.js — Client-side logic for the join/welcome page.
 *
 * Validates username + room, stores them in sessionStorage,
 * and redirects to chat.html.
 */

(function () {
  'use strict';

  // Username validation pattern — must match server-side validate.js
  const USERNAME_REGEX = /^[a-zA-Z0-9 -]{2,20}$/;

  const form        = document.getElementById('join-form');
  const usernameInput = document.getElementById('username-input');
  const roomInput   = document.getElementById('room-input');
  const joinBtn     = document.getElementById('join-btn');
  const errorDiv    = document.getElementById('join-error');

  /**
   * Display an error message in the error banner.
   * @param {string} msg
   */
  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.hidden = false;
    // Shake the card for emphasis
    errorDiv.classList.remove('shake');
    void errorDiv.offsetWidth; // force reflow to restart animation
    errorDiv.classList.add('shake');
  }

  function clearError() {
    errorDiv.hidden = true;
    errorDiv.textContent = '';
  }

  /**
   * Sanitize and normalize a room name (mirrors server logic).
   * @param {string} room
   * @returns {string}
   */
  function sanitizeRoom(room) {
    const trimmed = room.trim();
    if (!trimmed) return 'general';
    return trimmed.toLowerCase().replace(/\s+/g, '-').slice(0, 40);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();

    const username = usernameInput.value.trim();
    const room = sanitizeRoom(roomInput.value);

    // ── Client-side validation ──
    if (!username) {
      showError('Please enter a username.');
      usernameInput.focus();
      return;
    }

    if (username.length < 2) {
      showError('Username must be at least 2 characters.');
      usernameInput.focus();
      return;
    }

    if (username.length > 20) {
      showError('Username cannot exceed 20 characters.');
      usernameInput.focus();
      return;
    }

    if (!USERNAME_REGEX.test(username)) {
      showError('Username may only contain letters, numbers, spaces, and hyphens.');
      usernameInput.focus();
      return;
    }

    // ── Store in sessionStorage and navigate ──
    // sessionStorage is tab-scoped, so multiple tabs can have different identities.
    sessionStorage.setItem('chat_username', username);
    sessionStorage.setItem('chat_room', room);

    // Disable button to prevent double-submit
    joinBtn.disabled = true;
    joinBtn.querySelector('.btn-text').textContent = 'Joining…';

    window.location.href = '/chat.html';
  });

  // Auto-focus the username field on load
  usernameInput.focus();

  // Add a small CSS shake animation via inline style if not already in stylesheet
  const shakeStyle = document.createElement('style');
  shakeStyle.textContent = `
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      20%      { transform: translateX(-6px); }
      40%      { transform: translateX(6px); }
      60%      { transform: translateX(-4px); }
      80%      { transform: translateX(4px); }
    }
    .form-error.shake { animation: shake 0.4s ease; }
  `;
  document.head.appendChild(shakeStyle);
})();
