/**
 * rooms.js — Browse rooms page logic (Phase 2 + Creator Management).
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

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const loadingEl  = document.getElementById('rooms-loading');
  const errorEl    = document.getElementById('rooms-error');
  const errorText  = document.getElementById('rooms-error-text');
  const emptyEl    = document.getElementById('rooms-empty');
  const gridEl     = document.getElementById('rooms-grid');
  const retryBtn   = document.getElementById('rooms-retry-btn');
  const modal      = document.getElementById('password-modal');
  const modalTitle = document.getElementById('modal-room-name');
  const modalErr   = document.getElementById('modal-error');
  const modalPwd   = document.getElementById('modal-password');
  const modalJoin  = document.getElementById('modal-join-btn');
  const modalCancel= document.getElementById('modal-cancel-btn');

  let pendingRoomId = null;
  let currentUser = null;

  // ── Auth check ────────────────────────────────────────────────────────────
  async function init() {
    currentUser = await API.whoami();
    if (!currentUser) { window.location.href = '/auth.html'; return; }
    loadRooms();
  }

  // ── Load rooms ────────────────────────────────────────────────────────────
  async function loadRooms() {
    loadingEl.hidden = false;
    errorEl.hidden   = true;
    emptyEl.hidden   = true;
    gridEl.hidden    = true;
    gridEl.innerHTML = '';

    try {
      const data = await API.get('/api/rooms');
      loadingEl.hidden = true;

      if (!data.rooms || data.rooms.length === 0) {
        emptyEl.hidden = false;
        return;
      }

      gridEl.hidden = false;
      data.rooms.forEach(renderRoomCard);
    } catch (err) {
      loadingEl.hidden = true;
      errorText.textContent = err.message || 'Failed to load rooms.';
      errorEl.hidden = false;
    }
  }

  retryBtn.addEventListener('click', loadRooms);

  // ── Render a single room card ─────────────────────────────────────────────
  function renderRoomCard(room) {
    const card = document.createElement('div');
    card.className = `room-card${room.isFull ? ' room-card--full' : ''}`;
    card.dataset.roomId = room._id;

    const creatorName = room.creator ? room.creator.username : 'unknown';
    const creatorColor = avatarColor(creatorName);
    const statusLabel = room.status === 'private' ? '🔒 Private' : '🌐 Public';
    const statusClass = room.status === 'private' ? 'badge--private' : 'badge--public';

    const isCreator = currentUser && room.creator && room.creator._id === currentUser._id;

    card.innerHTML = `
      <div class="room-card-header">
        <div class="room-card-name">
          ${escapeHTML(room.name)}
          ${room.unreadCount > 0 ? `<span class="unread-badge">${room.unreadCount > 99 ? '99+' : room.unreadCount}</span>` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:0.25rem;">
          ${isCreator ? '<span class="badge badge--public" style="background:rgba(108,99,255,0.2); color:var(--accent-light);">Host</span>' : ''}
          <span class="badge ${statusClass}">${statusLabel}</span>
          ${isCreator ? `<button type="button" class="btn-card-delete" data-room-id="${room._id}" data-room-name="${escapeHTML(room.name)}" title="Delete Room" style="background:none; border:none; color:#f87171; cursor:pointer; padding:0.2rem; display:flex; align-items:center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}
        </div>
      </div>
      <div class="room-card-meta">
        <div class="room-card-creator">
          <span class="mini-avatar" style="background:${creatorColor};">${escapeHTML(creatorName.slice(0,2).toUpperCase())}</span>
          <span>${escapeHTML(creatorName)}</span>
        </div>
        <span class="room-card-count ${room.isFull ? 'room-card-count--full' : ''}">
          ${room.memberCount} / ${room.maxMembers}
          ${room.isFull ? '<span class="badge badge--full">Full</span>' : ''}
        </span>
      </div>
      <button class="btn-join${room.isFull ? ' btn-join--disabled' : ''}" ${room.isFull ? 'disabled aria-disabled="true"' : ''} aria-label="Join ${escapeHTML(room.name)}">
        ${room.isFull ? 'Room Full' : 'Join'}
      </button>
    `;


    const joinBtn = card.querySelector('.btn-join');
    if (!room.isFull) {
      joinBtn.addEventListener('click', () => handleJoin(room));
    }

    if (isCreator) {
      const delBtn = card.querySelector('.btn-card-delete');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleDeleteRoomCard(room._id, room.name);
        });
      }
    }

    gridEl.appendChild(card);
  }

  async function handleDeleteRoomCard(roomId, roomName) {
    if (!confirm(`Are you sure you want to delete #${roomName}? All messages and room data will be erased.`)) return;
    try {
      await API.delete(`/api/rooms/${roomId}`);
      loadRooms();
    } catch (err) {
      alert(err.message || 'Failed to delete room.');
    }
  }

  // ── Join logic ────────────────────────────────────────────────────────────
  async function handleJoin(room) {
    if (room.status === 'private') {
      openModal(room);
    } else {
      await joinRoom(room._id, null);
    }
  }

  async function joinRoom(roomId, password) {
    try {
      const body = password ? { password } : {};
      const data = await API.post(`/api/rooms/${roomId}/join`, body);
      window.location.href = `/chat.html?roomId=${data.room._id}`;
    } catch (err) {
      if (pendingRoomId) {
        modalErr.textContent = err.message;
        modalErr.hidden = false;
        modalJoin.disabled = false;
        modalJoin.textContent = 'Join Room';
      } else {
        alert(err.message);
      }
    }
  }

  // ── Password modal ────────────────────────────────────────────────────────
  function openModal(room) {
    pendingRoomId = room._id;
    modalTitle.textContent = `#${room.name}`;
    modalErr.hidden = true;
    modalPwd.value = '';
    modal.hidden = false;
    modalPwd.focus();
  }

  function closeModal() {
    modal.hidden = true;
    pendingRoomId = null;
    modalPwd.value = '';
    modalErr.hidden = true;
    modalJoin.disabled = false;
    modalJoin.textContent = 'Join Room';
  }

  modalCancel.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  modalJoin.addEventListener('click', async () => {
    const pwd = modalPwd.value;
    if (!pwd) { modalErr.textContent = 'Please enter the room password.'; modalErr.hidden = false; return; }
    modalJoin.disabled = true;
    modalJoin.textContent = 'Joining…';
    await joinRoom(pendingRoomId, pwd);
  });

  modalPwd.addEventListener('keydown', (e) => { if (e.key === 'Enter') modalJoin.click(); });

  init();
})();
