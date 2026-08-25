/**
 * chat.js — Main chat room client (Phase 2 + Creator Management).
 */

(function () {
  'use strict';

  // ── Helpers ───────────────────────────────────────────────────────────────
  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/`/g, '&#x60;');
  }
  function formatTime(date) {
    return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  function formatDateLabel(date) {
    const d = new Date(date), now = new Date();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function avatarColor(name) {
    const colors = ['#6C63FF','#3ECFCF','#f472b6','#fb923c','#a3e635','#facc15'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  }

  // ── Read roomId from URL ──────────────────────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('roomId');
  if (!roomId) { window.location.href = '/rooms.html'; return; }

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const messagesContainer   = document.getElementById('messages-container');
  const messageInput        = document.getElementById('message-input');
  const sendBtn             = document.getElementById('send-btn');
  const charCounter         = document.getElementById('char-counter');
  const userList            = document.getElementById('user-list');
  const userCountBadge      = document.getElementById('user-count-badge');
  const roomNameDisplay     = document.getElementById('room-name-display');
  const headerRoomName      = document.getElementById('header-room-name');
  const statusDot           = document.getElementById('status-dot');
  const statusText          = document.getElementById('status-text');
  const connectionBanner    = document.getElementById('connection-banner');
  const connectionBannerText= document.getElementById('connection-banner-text');
  const typingIndicator     = document.getElementById('typing-indicator');
  const typingText          = document.getElementById('typing-text');
  const leaveBtn            = document.getElementById('leave-btn');
  const sidebarToggleBtn    = document.getElementById('sidebar-toggle-btn');
  const sidebarCloseBtn     = document.getElementById('sidebar-close-btn');
  const sidebarOverlay      = document.getElementById('sidebar-overlay');
  const headerAvatar        = document.getElementById('header-avatar');

  // ── State ──────────────────────────────────────────────────────────────────
  let myUsername = null;
  let myProfilePic = null;
  let isNearBottom = true;
  let lastRenderedDate = null;
  let lastMessageUsername = null;
  let lastMessageTimestamp = null;
  const typingUsers = new Map();
  let typingTimeout = null;

  // Creator state
  let isCreator = false;
  let currentRoomData = null;

  // ── Auth + Init ───────────────────────────────────────────────────────────
  async function init() {
    const user = await API.whoami();
    if (!user) { window.location.href = '/auth.html'; return; }

    myUsername = user.username;
    myProfilePic = user.profilePic || '';

    // Render header avatar
    if (myProfilePic) {
      headerAvatar.innerHTML = `<img src="${escapeHTML(myProfilePic)}" alt="${escapeHTML(myUsername)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" />`;
    } else {
      const color = avatarColor(myUsername);
      headerAvatar.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;color:#fff;">${escapeHTML(myUsername.slice(0,2).toUpperCase())}</div>`;
    }

    // Fetch room name & creator status
    try {
      const data = await API.get(`/api/rooms/${roomId}`);
      currentRoomData = data.room;
      isCreator = data.room.isCreator;

      const roomName = data.room.name;
      roomNameDisplay.textContent = `#${roomName}`;
      headerRoomName.textContent  = `#${roomName}`;
      document.title = `#${roomName} — ChatRoom`;

      if (isCreator) {
        document.getElementById('creator-header-actions').hidden = false;
        setupCreatorControls();
      }
    } catch (_) {
      roomNameDisplay.textContent = '#room';
      headerRoomName.textContent  = '#room';
    }

    initSocket();
  }

  // ── Smart auto-scroll ─────────────────────────────────────────────────────
  messagesContainer.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
  });
  function scrollToBottom(force = false) {
    if (force || isNearBottom) messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // ── Date separators ───────────────────────────────────────────────────────
  function maybeInsertDateSeparator(date) {
    const label = formatDateLabel(date);
    if (label !== lastRenderedDate) {
      lastRenderedDate = label;
      const sep = document.createElement('div');
      sep.className = 'date-separator';
      sep.textContent = label;
      messagesContainer.appendChild(sep);
    }
  }

  // ── Render: chat message ─────────────────────────────────────────────────
  function renderMessage(msg, fromHistory = false) {
    const isOwn = msg.username === myUsername;
    const grouped = shouldGroup(msg.username, msg.createdAt);

    maybeInsertDateSeparator(msg.createdAt);

    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper message-wrapper--${isOwn ? 'own' : 'other'}`;
    if (grouped) wrapper.classList.add('message-wrapper--grouped');

    if (!isOwn && !grouped) {
      const sender = document.createElement('div');
      sender.className = 'message-sender';
      sender.textContent = escapeHTML(msg.username);
      wrapper.appendChild(sender);
    }

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = msg.message;
    wrapper.appendChild(bubble);

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = formatTime(msg.createdAt);
    wrapper.appendChild(time);

    messagesContainer.appendChild(wrapper);

    lastMessageUsername  = msg.username;
    lastMessageTimestamp = msg.createdAt;

    if (!fromHistory) scrollToBottom();
  }

  function shouldGroup(username, date) {
    if (!lastMessageUsername || lastMessageUsername !== username) return false;
    return new Date(date) - new Date(lastMessageTimestamp) < 60_000;
  }

  // ── Render: system message ────────────────────────────────────────────────
  function renderSystemMessage(text) {
    lastMessageUsername = null;
    const el = document.createElement('div');
    el.className = 'system-message';
    el.textContent = text;
    messagesContainer.appendChild(el);
    scrollToBottom();
  }

  // ── Online users panel ────────────────────────────────────────────────────
  function renderOnlineUsers(users) {
    userList.innerHTML = '';
    userCountBadge.textContent = users.length;

    users.forEach(({ username, userId, profilePic }) => {
      const li = document.createElement('li');
      li.className = 'user-item';
      const isSelf = username === myUsername;

      let avatarHTML;
      if (profilePic) {
        avatarHTML = `<img src="${escapeHTML(profilePic)}" alt="${escapeHTML(username)}" class="user-avatar-img" />`;
      } else {
        const color = avatarColor(username);
        avatarHTML = `<div class="user-avatar" style="background:${color};">${escapeHTML(username.slice(0,2).toUpperCase())}</div>`;
      }

      let actionsHTML = '';
      if (isCreator && !isSelf && userId) {
        actionsHTML = `
          <div class="user-action-buttons">
            <button type="button" class="btn-user-action btn-kick" data-user-id="${userId}" data-username="${escapeHTML(username)}" title="Kick ${escapeHTML(username)}">Kick</button>
            <button type="button" class="btn-user-action btn-ban" data-user-id="${userId}" data-username="${escapeHTML(username)}" title="Restrict ${escapeHTML(username)}">Restrict</button>
          </div>
        `;
      }

      li.innerHTML = `
        ${avatarHTML}
        <span class="user-name ${isSelf ? 'user-name--self' : ''}">${escapeHTML(username)}${isSelf ? ' (you)' : ''}</span>
        <span class="user-online-dot" aria-hidden="true"></span>
        ${actionsHTML}
      `;
      userList.appendChild(li);
    });

    if (isCreator) {
      userList.querySelectorAll('.btn-kick').forEach((btn) => {
        btn.addEventListener('click', () => handleKickUser(btn.dataset.userId, btn.dataset.username));
      });
      userList.querySelectorAll('.btn-ban').forEach((btn) => {
        btn.addEventListener('click', () => handleBanUser(btn.dataset.userId, btn.dataset.username));
      });
    }
  }

  async function handleKickUser(targetUserId, targetUsername) {
    if (!confirm(`Are you sure you want to kick ${targetUsername} from the room?`)) return;
    try {
      await API.post(`/api/rooms/${roomId}/kick`, { targetUserId });
    } catch (err) {
      alert(err.message || 'Failed to kick user.');
    }
  }

  async function handleBanUser(targetUserId, targetUsername) {
    if (!confirm(`Are you sure you want to restrict ${targetUsername} from entering this room?`)) return;
    try {
      await API.post(`/api/rooms/${roomId}/ban`, { targetUserId });
    } catch (err) {
      alert(err.message || 'Failed to restrict user.');
    }
  }

  // ── Connection status ─────────────────────────────────────────────────────
  function setStatus(state) {
    statusDot.className = `status-dot status-dot--${state}`;
    const labels = { connected: 'Connected', reconnecting: 'Reconnecting…', disconnected: 'Disconnected' };
    statusText.textContent = labels[state] || state;

    if (state === 'connected') {
      connectionBanner.hidden = true;
      connectionBanner.className = 'connection-banner';
      updateSendButton();
    } else {
      connectionBanner.hidden = false;
      connectionBanner.className = `connection-banner connection-banner--${state}`;
      connectionBannerText.textContent = labels[state];
      sendBtn.disabled = true;
    }
  }

  // ── Socket.IO ─────────────────────────────────────────────────────────────
  function initSocket() {
    const socket = io({
      withCredentials: true,
      reconnection:         true,
      reconnectionAttempts: Infinity,
      reconnectionDelay:    1000,
      reconnectionDelayMax: 5000,
      randomizationFactor:  0.3,
    });

    socket.on('connect', () => {
      setStatus('connected');
      socket.emit('join-room', { roomId });
    });

    socket.on('disconnect',    () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('reconnecting'));
    socket.io.on('reconnect_attempt', () => setStatus('reconnecting'));
    socket.io.on('reconnect',         () => setStatus('connected'));

    socket.on('recent-messages', (messages) => {
      messagesContainer.innerHTML = '';
      lastRenderedDate = null; lastMessageUsername = null; lastMessageTimestamp = null;
      messages.forEach((m) => renderMessage(m, true));
      scrollToBottom(true);
    });

    socket.on('receive-message', (msg) => {
      renderMessage(msg, false);
      clearTypingFor(msg.username);
    });

    socket.on('user-joined', ({ message: msg }) => renderSystemMessage(msg));
    socket.on('user-left',   ({ message: msg }) => renderSystemMessage(msg));
    socket.on('online-users', ({ users }) => renderOnlineUsers(users));
    socket.on('error-message', ({ error }) => renderSystemMessage(`⚠ ${error}`));

    // Creator / Management socket events
    socket.on('room-deleted', ({ message: msg }) => {
      alert(msg || 'This room has been deleted by the host.');
      window.location.href = '/rooms.html';
    });

    socket.on('kicked-from-room', ({ message: msg }) => {
      alert(msg || 'You were kicked from this room by the host.');
      window.location.href = '/rooms.html';
    });

    socket.on('banned-from-room', ({ message: msg }) => {
      alert(msg || 'You have been restricted from entering this room by the host.');
      window.location.href = '/rooms.html';
    });

    socket.on('room-updated', ({ name }) => {
      headerRoomName.textContent  = `#${name}`;
      roomNameDisplay.textContent = `#${name}`;
      document.title = `#${name} — ChatRoom`;
    });

    socket.on('typing',      ({ username: u }) => {
      if (u === myUsername) return;
      const tid = typingUsers.get(u);
      if (tid) clearTimeout(tid);
      typingUsers.set(u, setTimeout(() => clearTypingFor(u), 3000));
      updateTypingUI();
    });
    socket.on('stop-typing', ({ username: u }) => clearTypingFor(u));

    // ── Typing emission ───────────────────────────────────────────────────
    function emitTyping() {
      if (!typingTimeout) {
        socket.emit('typing');
        typingTimeout = setTimeout(() => {
          socket.emit('stop-typing');
          typingTimeout = null;
        }, 2000);
      }
    }

    // ── Message input ─────────────────────────────────────────────────────
    messageInput.addEventListener('input', () => {
      autoResizeTextarea();
      updateSendButton();
      const len = messageInput.value.length;
      charCounter.textContent = `${len} / 500`;
      charCounter.className = 'char-counter';
      if (len > 450) charCounter.classList.add('char-counter--warn');
      if (len > 490) charCounter.classList.add('char-counter--error');
      if (messageInput.value.trim()) emitTyping();
    });

    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    sendBtn.addEventListener('click', sendMessage);

    function sendMessage() {
      const text = messageInput.value.trim();
      if (!text || text.length > 500 || !socket.connected) return;
      socket.emit('send-message', { message: text });
      messageInput.value = '';
      autoResizeTextarea(); updateSendButton();
      charCounter.textContent = '0 / 500';
      charCounter.className = 'char-counter';
      socket.emit('stop-typing');
      if (typingTimeout) { clearTimeout(typingTimeout); typingTimeout = null; }
      messageInput.focus();
    }

    // ── Leave room ────────────────────────────────────────────────────────
    async function cleanLeave() {
      socket.emit('leave-room');
      socket.disconnect();
      try { await API.post(`/api/rooms/${roomId}/leave`, {}); } catch (_) {}
    }

    window.__chatLeave = cleanLeave;

    async function leaveRoom() {
      await cleanLeave();
      window.location.href = '/rooms.html';
    }

    leaveBtn.addEventListener('click', leaveRoom);
    window.addEventListener('beforeunload', () => { socket.emit('leave-room'); });

    setStatus('reconnecting');
    messageInput.focus();
  }

  // ── Creator Management Modal Setup ────────────────────────────────────────
  function setupCreatorControls() {
    const settingsBtn = document.getElementById('room-settings-btn');
    const deleteBtn = document.getElementById('delete-room-btn');
    const settingsModal = document.getElementById('room-settings-modal');
    const deleteModal = document.getElementById('room-delete-modal');
    const settingsForm = document.getElementById('room-settings-form');

    const settingsName = document.getElementById('settings-name');
    const settingsTogglePublic = document.getElementById('settings-toggle-public');
    const settingsTogglePrivate = document.getElementById('settings-toggle-private');
    const settingsPwdGroup = document.getElementById('settings-pwd-group');
    const settingsPwd = document.getElementById('settings-pwd');
    const settingsMax = document.getElementById('settings-max');
    const settingsMaxVal = document.getElementById('settings-max-val');
    const bannedList = document.getElementById('banned-users-list');

    const settingsCancelBtn = document.getElementById('settings-cancel-btn');
    const deleteCancelBtn = document.getElementById('delete-cancel-btn');
    const deleteConfirmBtn = document.getElementById('delete-confirm-btn');

    settingsBtn.addEventListener('click', async () => {
      settingsModal.hidden = false;
      document.getElementById('settings-error').hidden = true;
      document.getElementById('settings-success').hidden = true;

      try {
        const data = await API.get(`/api/rooms/${roomId}`);
        currentRoomData = data.room;
      } catch (_) {}

      if (currentRoomData) {
        settingsName.value = currentRoomData.name;
        settingsMax.value = currentRoomData.maxMembers;
        settingsMaxVal.textContent = currentRoomData.maxMembers;

        const isPrivate = currentRoomData.status === 'private';
        settingsTogglePrivate.querySelector('input').checked = isPrivate;
        settingsTogglePublic.querySelector('input').checked = !isPrivate;
        settingsTogglePrivate.classList.toggle('toggle-option--active', isPrivate);
        settingsTogglePublic.classList.toggle('toggle-option--active', !isPrivate);
        settingsPwdGroup.hidden = !isPrivate;
      }

      loadBannedUsers();
    });

    settingsTogglePublic.addEventListener('click', () => {
      settingsTogglePublic.querySelector('input').checked = true;
      settingsTogglePublic.classList.add('toggle-option--active');
      settingsTogglePrivate.classList.remove('toggle-option--active');
      settingsPwdGroup.hidden = true;
    });
    settingsTogglePrivate.addEventListener('click', () => {
      settingsTogglePrivate.querySelector('input').checked = true;
      settingsTogglePrivate.classList.add('toggle-option--active');
      settingsTogglePublic.classList.remove('toggle-option--active');
      settingsPwdGroup.hidden = false;
    });

    settingsMax.addEventListener('input', () => {
      settingsMaxVal.textContent = settingsMax.value;
    });

    settingsCancelBtn.addEventListener('click', () => { settingsModal.hidden = true; });

    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('settings-error');
      const succEl = document.getElementById('settings-success');
      errEl.hidden = true; succEl.hidden = true;

      const name = settingsName.value.trim();
      const status = settingsTogglePrivate.querySelector('input').checked ? 'private' : 'public';
      const password = settingsPwd.value;
      const maxMembers = parseInt(settingsMax.value, 10);

      try {
        const res = await API.patch(`/api/rooms/${roomId}/settings`, { name, status, password, maxMembers });
        succEl.hidden = false;
        if (currentRoomData) {
          currentRoomData.name = res.room.name;
          currentRoomData.status = res.room.status;
          currentRoomData.maxMembers = res.room.maxMembers;
        }
        settingsPwd.value = '';
        setTimeout(() => { settingsModal.hidden = true; }, 1000);
      } catch (err) {
        errEl.textContent = err.message || 'Failed to update settings.';
        errEl.hidden = false;
      }
    });

    async function loadBannedUsers() {
      bannedList.innerHTML = '<li style="font-size:0.8rem; color:var(--text-muted);">Loading…</li>';
      try {
        const data = await API.get(`/api/rooms/${roomId}/banned`);
        if (!data.bannedUsers || !data.bannedUsers.length) {
          bannedList.innerHTML = '<li style="font-size:0.8rem; color:var(--text-muted);">No restricted users.</li>';
          return;
        }

        bannedList.innerHTML = '';
        data.bannedUsers.forEach((u) => {
          const li = document.createElement('li');
          li.style.cssText = 'display:flex; align-items:center; justify-content:space-between; font-size:0.825rem; background:var(--bg-elevated); padding:0.4rem 0.6rem; border-radius:var(--radius-sm);';
          li.innerHTML = `
            <span>${escapeHTML(u.username)}</span>
            <button type="button" class="btn-ghost btn-sm" style="padding:0.2rem 0.5rem; font-size:0.75rem;">Lift Restriction</button>
          `;
          li.querySelector('button').addEventListener('click', async () => {
            try {
              await API.post(`/api/rooms/${roomId}/unban`, { targetUserId: u._id });
              loadBannedUsers();
            } catch (err) {
              alert(err.message || 'Failed to lift restriction.');
            }
          });
          bannedList.appendChild(li);
        });
      } catch (_) {
        bannedList.innerHTML = '<li style="font-size:0.8rem; color:var(--text-muted);">Failed to load list.</li>';
      }
    }

    deleteBtn.addEventListener('click', () => {
      deleteModal.hidden = false;
      document.getElementById('delete-room-name-display').textContent = currentRoomData ? `#${currentRoomData.name}` : 'this room';
    });

    deleteCancelBtn.addEventListener('click', () => { deleteModal.hidden = true; });

    deleteConfirmBtn.addEventListener('click', async () => {
      deleteConfirmBtn.disabled = true;
      deleteConfirmBtn.textContent = 'Deleting…';
      try {
        await API.delete(`/api/rooms/${roomId}`);
        window.location.href = '/rooms.html';
      } catch (err) {
        alert(err.message || 'Failed to delete room.');
        deleteConfirmBtn.disabled = false;
        deleteConfirmBtn.textContent = 'Delete Room';
      }
    });
  }

  // ── Typing indicator UI ───────────────────────────────────────────────────
  function clearTypingFor(username) {
    const tid = typingUsers.get(username);
    if (tid) clearTimeout(tid);
    typingUsers.delete(username);
    updateTypingUI();
  }
  function updateTypingUI() {
    const names = Array.from(typingUsers.keys()).filter(n => n !== myUsername);
    if (!names.length) { typingIndicator.hidden = true; return; }
    typingIndicator.hidden = false;
    if (names.length === 1) typingText.textContent = `${names[0]} is typing…`;
    else if (names.length === 2) typingText.textContent = `${names[0]} and ${names[1]} are typing…`;
    else typingText.textContent = `${names.length} people are typing…`;
  }

  // ── Textarea auto-resize ──────────────────────────────────────────────────
  function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
  }
  function updateSendButton() {
    const trimmed = messageInput.value.trim();
    sendBtn.disabled = !trimmed || trimmed.length > 500;
  }

  // ── Sidebar toggle (mobile) ───────────────────────────────────────────────
  sidebarToggleBtn.addEventListener('click', () => {
    const open = document.body.classList.toggle('sidebar-open');
    sidebarToggleBtn.setAttribute('aria-expanded', open);
  });
  sidebarCloseBtn.addEventListener('click', () => { document.body.classList.remove('sidebar-open'); sidebarToggleBtn.setAttribute('aria-expanded', false); });
  sidebarOverlay.addEventListener('click',  () => { document.body.classList.remove('sidebar-open'); sidebarToggleBtn.setAttribute('aria-expanded', false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { document.body.classList.remove('sidebar-open'); } });

  init();
})();
