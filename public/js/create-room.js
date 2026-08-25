/**
 * create-room.js — Create room form logic.
 */

(function () {
  'use strict';

  async function init() {
    const user = await API.whoami();
    if (!user) { window.location.href = '/auth.html'; return; }
  }

  const form          = document.getElementById('create-room-form');
  const errorDiv      = document.getElementById('create-error');
  const createBtn     = document.getElementById('create-btn');
  const maxInput      = document.getElementById('max-members');
  const maxDisplay    = document.getElementById('max-members-display');
  const pwdGroup      = document.getElementById('room-password-group');
  const pwdInput      = document.getElementById('room-password');
  const statusRadios  = document.querySelectorAll('input[name="status"]');
  const toggleOptions = document.querySelectorAll('.toggle-option');

  // ── Max members slider live update ──────────────────────────────────────
  maxInput.addEventListener('input', () => {
    maxDisplay.textContent = maxInput.value;
  });

  // ── Public / Private toggle ──────────────────────────────────────────────
  statusRadios.forEach((radio, i) => {
    radio.addEventListener('change', () => {
      toggleOptions.forEach((opt, j) => opt.classList.toggle('toggle-option--active', i === j));
      const isPrivate = radio.value === 'private';
      pwdGroup.hidden = !isPrivate;
      pwdInput.required = isPrivate;
    });
  });

  // ── Error helpers ──────────────────────────────────────────────────────
  function showError(msg) { errorDiv.textContent = msg; errorDiv.hidden = false; }
  function clearError()   { errorDiv.hidden = true; errorDiv.textContent = ''; }

  // ── Submit ─────────────────────────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const name       = document.getElementById('room-name').value.trim();
    const status     = document.querySelector('input[name="status"]:checked').value;
    const password   = pwdInput.value;
    const maxMembers = parseInt(maxInput.value, 10);

    // Client-side validation
    if (name.length < 3 || name.length > 30) {
      showError('Room name must be 3–30 characters.');
      return;
    }
    if (status === 'private' && password.length < 4) {
      showError('Room password must be at least 4 characters.');
      return;
    }

    createBtn.disabled = true;
    createBtn.textContent = 'Creating…';

    try {
      const body = { name, status, maxMembers };
      if (status === 'private') body.password = password;

      const data = await API.post('/api/rooms', body);
      // Creator auto-joined; go straight to the chat room
      window.location.href = `/chat.html?roomId=${data.room._id}`;
    } catch (err) {
      showError(err.message);
      createBtn.disabled = false;
      createBtn.textContent = 'Create Room';
    }
  });

  init();
})();
