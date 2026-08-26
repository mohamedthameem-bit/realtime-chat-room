/**
 * chat.js — Main chat room client (Phase 5: edit/delete, reply, reactions, mentions).
 */

(function () {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────────────────────
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
  // Render @mentions in a text string safely
  function renderMentions(text, myUsername) {
    const escaped = escapeHTML(text);
    return escaped.replace(/@(\w+)/g, (match, name) => {
      if (name.toLowerCase() === myUsername.toLowerCase()) {
        return `<span class="mention-tag">${match}</span>`;
      }
      return `<span class="mention-tag">${match}</span>`;
    });
  }
  function containsMention(text, username) {
    const re = new RegExp(`@${username}\\b`, 'i');
    return re.test(text);
  }

  // ── Toasts ──────────────────────────────────────────────────────────────────
  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent);"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      <span>${escapeHTML(message)}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'opacity 0.3s, transform 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ── Read roomId from URL ────────────────────────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('roomId');
  if (!roomId) { window.location.href = '/rooms.html'; return; }

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const messagesContainer    = document.getElementById('messages-container');
  const messageInput         = document.getElementById('message-input');
  const sendBtn              = document.getElementById('send-btn');
  const charCounter          = document.getElementById('char-counter');
  const userList             = document.getElementById('user-list');
  const userCountBadge       = document.getElementById('user-count-badge');
  const roomNameDisplay      = document.getElementById('room-name-display');
  const headerRoomName       = document.getElementById('header-room-name');
  const statusDot            = document.getElementById('status-dot');
  const statusText           = document.getElementById('status-text');
  const connectionBanner     = document.getElementById('connection-banner');
  const connectionBannerText = document.getElementById('connection-banner-text');
  const typingIndicator      = document.getElementById('typing-indicator');
  const typingText           = document.getElementById('typing-text');
  const leaveBtn             = document.getElementById('leave-btn');
  const sidebarToggleBtn     = document.getElementById('sidebar-toggle-btn');
  const sidebarCloseBtn      = document.getElementById('sidebar-close-btn');
  const sidebarOverlay       = document.getElementById('sidebar-overlay');
  const headerAvatar         = document.getElementById('header-avatar');
  // Phase 5 new elements
  const replyPreviewBar      = document.getElementById('reply-preview-bar');
  const replyPreviewName     = document.getElementById('reply-preview-name');
  const replyPreviewText     = document.getElementById('reply-preview-text');
  const replyCancelBtn       = document.getElementById('reply-cancel-btn');
  const mentionDropdown      = document.getElementById('mention-dropdown');

  // ── State ──────────────────────────────────────────────────────────────────
  let myUsername   = null;
  let myUserId     = null;
  let myProfilePic = null;
  let isNearBottom = true;
  let lastRenderedDate      = null;
  let lastMessageUsername   = null;
  let lastMessageTimestamp  = null;
  const typingUsers = new Map();
  let typingTimeout = null;

  // Creator state
  let isCreator     = false;
  let currentRoomData = null;

  // Phase 5/6 state
  let replyToId       = null;
  let onlineUsersList = [];
  let onlineUsersGlobal = {};
  let mentionSearch   = '';
  let mentionActive   = false;
  let socketRef       = null;

  // ── Auth + Init ───────────────────────────────────────────────────────────
  async function init() {
    const user = await API.whoami();
    if (!user) { window.location.href = '/auth.html'; return; }

    myUsername   = user.username;
    myUserId     = String(user._id);
    myProfilePic = user.profilePic || '';

    if (myProfilePic) {
      headerAvatar.innerHTML = `<img src="${escapeHTML(myProfilePic)}" alt="${escapeHTML(myUsername)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" />`;
    } else {
      const color = avatarColor(myUsername);
      headerAvatar.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;color:#fff;">${escapeHTML(myUsername.slice(0,2).toUpperCase())}</div>`;
    }

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

    replyCancelBtn.addEventListener('click', clearReply);
    initSocket();
  }

  // ── Reply state helpers ───────────────────────────────────────────────────
  function setReply(msgId, username, text) {
    replyToId = msgId;
    replyPreviewName.textContent = `@${username}`;
    replyPreviewText.textContent = text;
    replyPreviewBar.hidden = false;
    messageInput.focus();
  }
  function clearReply() {
    replyToId = null;
    replyPreviewBar.hidden = true;
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

  // ── Render reactions bar ──────────────────────────────────────────────────
  function renderReactionsBar(wrapper, reactions, msgId) {
    const normalized = (reactions || []).filter((r) => r.users && r.users.length > 0);
    const existingBar = wrapper.querySelector('.reactions-bar');
    if (existingBar) existingBar.remove();
    if (!normalized.length) return;

    const bar = document.createElement('div');
    bar.className = 'reactions-bar';

    normalized.forEach(({ emoji, count, users }) => {
      const actualCount = (count !== undefined) ? count : users.length;
      const isMine = users && users.some((u) => String(u) === myUserId);
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `reaction-pill${isMine ? ' reaction-pill--mine' : ''}`;
      pill.title = `${emoji} ${actualCount}`;
      pill.innerHTML = `<span class="reaction-pill-emoji">${emoji}</span><span class="reaction-pill-count">${actualCount}</span>`;
      pill.addEventListener('click', () => {
        if (socketRef) socketRef.emit('react-message', { messageId: msgId, emoji });
      });
      bar.appendChild(pill);
    });
    wrapper.appendChild(bar);
  }

  // ── Render: chat message ──────────────────────────────────────────────────
  function renderMessage(msg, fromHistory = false) {
    if (msg.deleted && !fromHistory) return;

    const isOwn = msg.username === myUsername;
    const grouped = shouldGroup(msg.username, msg.createdAt);
    const isMentioned = !isOwn && containsMention(msg.message || '', myUsername);

    maybeInsertDateSeparator(msg.createdAt);

    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper message-wrapper--${isOwn ? 'own' : 'other'}`;
    if (grouped) wrapper.classList.add('message-wrapper--grouped');
    if (isMentioned) wrapper.classList.add('message-wrapper--mentioned');
    wrapper.dataset.msgId = msg._id ? msg._id.toString() : '';

    if (!isOwn && !grouped) {
      const sender = document.createElement('div');
      sender.className = 'message-sender';
      sender.textContent = escapeHTML(msg.username);
      wrapper.appendChild(sender);
    }

    if (msg.replySnapshot && msg.replySnapshot.username) {
      const quote = document.createElement('div');
      quote.className = 'reply-quote';
      quote.innerHTML = `<div class="reply-quote-name">${escapeHTML(msg.replySnapshot.username)}</div><div class="reply-quote-text">${escapeHTML(msg.replySnapshot.message || '')}</div>`;
      wrapper.appendChild(quote);
    }

    const bubble = document.createElement('div');
    bubble.className = `message-bubble${msg.deleted ? ' message-bubble--deleted' : ''}`;
    if (msg.deleted) {
      bubble.textContent = '🚫 Message deleted';
    } else {
      bubble.innerHTML = renderMentions(msg.message || '', myUsername);
    }
    wrapper.appendChild(bubble);

    const timeRow = document.createElement('div');
    timeRow.className = 'message-time';
    timeRow.textContent = formatTime(msg.createdAt);
    if (msg.edited && !msg.deleted) {
      const editedLabel = document.createElement('span');
      editedLabel.className = 'msg-edited-label';
      editedLabel.textContent = '(edited)';
      timeRow.appendChild(editedLabel);
    }
    wrapper.appendChild(timeRow);

    if (!msg.deleted && msg.reactions && msg.reactions.length > 0) {
      renderReactionsBar(wrapper, msg.reactions, msg._id);
    }

    if (!msg.deleted) {
      const actions = buildActionMenu(msg, isOwn, wrapper);
      wrapper.appendChild(actions);
    }

    messagesContainer.appendChild(wrapper);
    lastMessageUsername  = msg.username;
    lastMessageTimestamp = msg.createdAt;
    if (!fromHistory) scrollToBottom();
  }

  const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

  function buildActionMenu(msg, isOwn, wrapper) {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    const reactBtn = document.createElement('button');
    reactBtn.type = 'button';
    reactBtn.className = 'msg-action-btn';
    reactBtn.title = 'React';
    reactBtn.textContent = '😊';
    reactBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleReactionPicker(wrapper, msg._id);
    });
    actions.appendChild(reactBtn);

    const replyBtn = document.createElement('button');
    replyBtn.type = 'button';
    replyBtn.className = 'msg-action-btn';
    replyBtn.title = 'Reply';
    replyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>`;
    replyBtn.addEventListener('click', () => {
      const text = msg.message || '';
      setReply(msg._id, msg.username, text.slice(0, 60) + (text.length > 60 ? '…' : ''));
    });
    actions.appendChild(replyBtn);

    if (isOwn && !msg.deleted) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'msg-action-btn';
      editBtn.title = 'Edit';
      editBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
      editBtn.addEventListener('click', () => startInlineEdit(wrapper, msg));
      actions.appendChild(editBtn);
    }

    const canDelete = isOwn || isCreator;
    if (canDelete && !msg.deleted) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'msg-action-btn msg-action-btn--danger';
      delBtn.title = 'Delete';
      delBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
      delBtn.addEventListener('click', () => {
        if (confirm('Delete this message?')) {
          if (socketRef) socketRef.emit('delete-message', { messageId: msg._id });
        }
      });
      actions.appendChild(delBtn);
    }
    return actions;
  }

  function toggleReactionPicker(wrapper, msgId) {
    document.querySelectorAll('.reaction-picker').forEach((p) => p.remove());
    const picker = document.createElement('div');
    picker.className = 'reaction-picker';
    EMOJIS.forEach((emoji) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'reaction-emoji-btn';
      btn.textContent = emoji;
      btn.title = emoji;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        picker.remove();
        if (socketRef) socketRef.emit('react-message', { messageId: msgId, emoji });
      });
      picker.appendChild(btn);
    });
    wrapper.appendChild(picker);
    setTimeout(() => {
      document.addEventListener('click', function closePicker() {
        picker.remove();
        document.removeEventListener('click', closePicker);
      }, { once: true });
    }, 10);
  }

  function startInlineEdit(wrapper, msg) {
    const bubble = wrapper.querySelector('.message-bubble');
    if (!bubble) return;
    const originalText = msg.message;
    const textarea = document.createElement('textarea');
    textarea.className = 'msg-edit-area';
    textarea.value = originalText;
    textarea.rows = 1;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    const editActions = document.createElement('div');
    editActions.className = 'msg-edit-actions';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'msg-edit-save';
    saveBtn.textContent = 'Save';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'msg-edit-cancel';
    cancelBtn.textContent = 'Cancel';
    editActions.appendChild(cancelBtn);
    editActions.appendChild(saveBtn);
    bubble.innerHTML = '';
    bubble.appendChild(textarea);
    bubble.appendChild(editActions);
    textarea.focus();
    textarea.selectionStart = textarea.value.length;
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveBtn.click(); }
      if (e.key === 'Escape') cancelBtn.click();
    });
    cancelBtn.addEventListener('click', () => {
      bubble.innerHTML = renderMentions(originalText, myUsername);
    });
    saveBtn.addEventListener('click', () => {
      const newText = textarea.value.trim();
      if (!newText || newText === originalText) { cancelBtn.click(); return; }
      if (socketRef) socketRef.emit('edit-message', { messageId: msg._id, newText });
      bubble.innerHTML = renderMentions(newText, myUsername);
      msg.message = newText;
    });
  }

  function shouldGroup(username, date) {
    if (!lastMessageUsername || lastMessageUsername !== username) return false;
    return new Date(date) - new Date(lastMessageTimestamp) < 60_000;
  }

  function updateEditedMessage({ _id, message }) {
    const wrapper = messagesContainer.querySelector(`[data-msg-id="${_id}"]`);
    if (!wrapper) return;
    const bubble = wrapper.querySelector('.message-bubble');
    if (!bubble || bubble.classList.contains('message-bubble--deleted')) return;
    bubble.innerHTML = renderMentions(message, myUsername);
    const timeRow = wrapper.querySelector('.message-time');
    if (timeRow && !timeRow.querySelector('.msg-edited-label')) {
      const lbl = document.createElement('span');
      lbl.className = 'msg-edited-label';
      lbl.textContent = '(edited)';
      timeRow.appendChild(lbl);
    }
  }

  function updateDeletedMessage({ _id }) {
    const wrapper = messagesContainer.querySelector(`[data-msg-id="${_id}"]`);
    if (!wrapper) return;
    const bubble = wrapper.querySelector('.message-bubble');
    if (!bubble) return;
    bubble.className = 'message-bubble message-bubble--deleted';
    bubble.textContent = '🚫 Message deleted';
    wrapper.querySelector('.msg-actions')?.remove();
    wrapper.querySelector('.reactions-bar')?.remove();
  }

  function updateReactions({ _id, reactions }) {
    const wrapper = messagesContainer.querySelector(`[data-msg-id="${_id}"]`);
    if (!wrapper) return;
    renderReactionsBar(wrapper, reactions, _id);
  }

  function renderSystemMessage(text) {
    lastMessageUsername = null;
    const el = document.createElement('div');
    el.className = 'system-message';
    el.textContent = text;
    messagesContainer.appendChild(el);
    scrollToBottom();
  }

  // ── Show Online Users ─────────────────────────────────────────────────────
  function updateOnlineUsers(users) {
    if (!userList) return;
    onlineUsersList = users;
    userList.innerHTML = '';
    userCountBadge.textContent = users.length;

    users.forEach((u) => {
      const li = document.createElement('li');
      li.className = 'user-item';
      const isMe = String(u.userId) === String(myUserId);
      const displayUsername = isMe ? `${u.username} (You)` : u.username;
      const color = avatarColor(u.username);
      const initials = escapeHTML(u.username.slice(0, 2).toUpperCase());
      const status = onlineUsersGlobal[u.userId]?.status || 'online';

      const avatarHtml = u.profilePic
        ? `<img src="${escapeHTML(u.profilePic)}" alt="" class="user-avatar-img" />`
        : `<div class="user-avatar" style="background:${color};" aria-hidden="true">${initials}</div>`;

      const actionHtml = isMe ? '' : `
        <a href="/dm.html?with=${escapeHTML(u.userId)}" class="btn-ghost" style="padding: 4px 8px; font-size: 0.75rem;" title="Direct Message">Message</a>
      `;

      li.innerHTML = `
        <div style="position:relative; display:inline-block;">
          ${avatarHtml}
          <span class="status-dot status-dot--${status}" style="position:absolute; bottom:0; right:0; width:10px; height:10px;"></span>
        </div>
        <span class="user-name ${isMe ? 'user-name--self' : ''}" title="${escapeHTML(u.username)}">${escapeHTML(displayUsername)}</span>
        ${actionHtml}
      `;
      userList.appendChild(li);
    });
  }

  // ── Connection status ─────────────────────────────────────────────────────
  function setStatus(state) {
    statusDot.className = `status-dot status-dot--${state}`;
    const labels = { connected: 'Connected', reconnecting: 'Reconnecting…', disconnected: 'Disconnected' };
    statusText.textContent = labels[state] || state;
    if (state === 'connected') {
      connectionBanner.hidden = true;
    } else {
      connectionBanner.hidden = false;
      connectionBanner.className = `connection-banner connection-banner--${state}`;
      connectionBannerText.textContent = labels[state];
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
    });
    socketRef = socket;

    socket.on('connect', () => {
      setStatus('connected');
      socket.emit('join-room', { roomId });
    });

    socket.on('disconnect',    () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('reconnecting'));
    
    socket.on('recent-messages', (messages) => {
      messagesContainer.innerHTML = '';
      lastRenderedDate = null; lastMessageUsername = null; lastMessageTimestamp = null;
      messages.forEach((m) => renderMessage(m, true));
      scrollToBottom(true);
    });

    socket.on('receive-message', (msg) => {
      renderMessage(msg, false);
    });

    socket.on('message-edited',  (data) => updateEditedMessage(data));
    socket.on('message-deleted', (data) => updateDeletedMessage(data));
    socket.on('message-reacted', (data) => updateReactions(data));

    socket.on('user-joined', ({ message: msg }) => renderSystemMessage(msg));
    socket.on('user-left',   ({ message: msg }) => renderSystemMessage(msg));
    socket.on('online-users', ({ users }) => updateOnlineUsers(users));
    
    socket.on('user-status-changed', ({ userId, status }) => {
      onlineUsersGlobal[userId] = { status };
      updateOnlineUsers(onlineUsersList);
    });

    socket.on('friend-request-received', ({ from }) => {
      showToast(`New friend request from ${escapeHTML(from.username)}`);
    });

    socket.on('dm-notification', (msg) => {
      if (String(msg.userId) !== String(myUserId)) {
        showToast(`New DM from ${escapeHTML(msg.username)}`);
      }
    });

    socket.on('error-message', ({ error }) => renderSystemMessage(`⚠ ${error}`));

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

      // @mention detection
      const val = messageInput.value;
      const pos = messageInput.selectionStart;
      const beforeCursor = val.slice(0, pos);
      const atMatch = beforeCursor.match(/@(\w*)$/);
      if (atMatch) {
        mentionActive = true;
        mentionSearch = atMatch[1];
        showMentionDropdown(mentionSearch);
      } else {
        hideMentionDropdown();
      }
    });

    messageInput.addEventListener('keydown', (e) => {
      if (mentionActive && !mentionDropdown.hidden) {
        if (e.key === 'Escape') { e.preventDefault(); hideMentionDropdown(); return; }
        if (e.key === 'Tab' || e.key === 'Enter') {
          const activeItem = mentionDropdown.querySelector('.mention-item--active');
          if (activeItem) {
            e.preventDefault();
            const name = activeItem.querySelector('.mention-item-name').textContent.slice(1);
            insertMention(name);
            return;
          }
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const items = Array.from(mentionDropdown.querySelectorAll('.mention-item'));
          const curr = mentionDropdown.querySelector('.mention-item--active');
          let idx = items.indexOf(curr);
          items.forEach(i => i.classList.remove('mention-item--active'));
          if (e.key === 'ArrowDown') idx = (idx + 1) % items.length;
          else idx = (idx - 1 + items.length) % items.length;
          items[idx]?.classList.add('mention-item--active');
          return;
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    sendBtn.addEventListener('click', sendMessage);

    function sendMessage() {
      const text = messageInput.value.trim();
      if (!text || text.length > 500 || !socket.connected) return;
      const payload = { message: text };
      if (replyToId) payload.replyToId = replyToId;
      socket.emit('send-message', payload);
      messageInput.value = '';
      autoResizeTextarea(); updateSendButton();
      charCounter.textContent = '0 / 500';
      charCounter.className = 'char-counter';
      socket.emit('stop-typing');
      if (typingTimeout) { clearTimeout(typingTimeout); typingTimeout = null; }
      clearReply();
      hideMentionDropdown();
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
