/**
 * dm.js — Direct Messaging Chat UI (Phase 6)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

  // ── DOM Elements ────────────────────────────────────────────────────────────
  const messagesContainer = document.getElementById('messages-container');
  const chatForm          = document.getElementById('chat-form');
  const messageInput      = document.getElementById('message-input');
  const sendBtn           = document.getElementById('send-btn');
  const connectionBanner  = document.getElementById('connection-banner');
  const connectionText    = document.getElementById('connection-text');
  const charCounter       = document.getElementById('char-counter');

  const headerAvatar      = document.getElementById('header-avatar');
  const headerName        = document.getElementById('header-name');
  const headerStatus      = document.getElementById('header-status');

  const replyPreviewBar   = document.getElementById('reply-preview-bar');
  const replyPreviewText  = document.getElementById('reply-preview-text');
  const replyPreviewAuthor= document.getElementById('reply-preview-author');
  const replyCancelBtn    = document.getElementById('reply-cancel-btn');

  // WebRTC DOM
  const callBtn            = document.getElementById('call-btn');
  const incomingCallModal  = document.getElementById('incoming-call-modal');
  const incomingCallAvatar = document.getElementById('incoming-call-avatar');
  const incomingCallName   = document.getElementById('incoming-call-name');
  const acceptCallBtn      = document.getElementById('accept-call-btn');
  const rejectCallBtn      = document.getElementById('reject-call-btn');
  const activeCallWidget   = document.getElementById('active-call-widget');
  const callStatusText     = document.getElementById('call-status-text');
  const callDurationEl     = document.getElementById('call-duration');
  const remoteAudio        = document.getElementById('remote-audio');
  const muteCallBtn        = document.getElementById('mute-call-btn');
  const endCallBtn         = document.getElementById('end-call-btn');
  const micIcon            = document.getElementById('mic-icon');

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function escapeHTML(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function avatarColor(name) {
    const palette = ['#6C63FF', '#3ECFCF', '#f472b6', '#fb923c', '#a3e635', '#facc15'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return palette[Math.abs(h) % palette.length];
  }

  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  // ── Read targetUserId from URL ──────────────────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  const targetUserId = params.get('with');
  if (!targetUserId) {
    window.location.href = '/dms.html';
    return;
  }

  // ── Chat State ──────────────────────────────────────────────────────────────
  let myUsername    = '';
  let myUserId      = null;
  let myProfilePic  = '';
  let targetUser    = null;
  let conversation  = null;
  
  let replyToId       = null;
  let socketRef       = null;
  
  let lastRenderedDate = null;
  let lastMessageUsername = null;
  let lastMessageTimestamp = null;

  let typingTimeout = null;
  let isTyping = false;

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  async function init() {
    const user = await API.whoami();
    if (!user) { window.location.href = '/auth.html'; return; }

    myUsername   = user.username;
    myUserId     = String(user._id);
    myProfilePic = user.profilePic || '';

    try {
      // Start or get conversation
      const res = await API.post('/api/dm/conversations', { targetUserId });
      conversation = res.conversation;
      targetUser = conversation.participants.find(p => String(p._id) === targetUserId);
      
      updateHeader();
    } catch (err) {
      alert(err.message || 'Failed to load conversation.');
      window.location.href = '/dms.html';
      return;
    }

    replyCancelBtn.addEventListener('click', clearReply);
    initSocket();
  }

  function updateHeader() {
    if (!targetUser) return;
    
    const color = avatarColor(targetUser.username);
    const initials = escapeHTML(targetUser.username.slice(0, 2).toUpperCase());
    const avatarHtml = targetUser.profilePic
      ? `<img src="${escapeHTML(targetUser.profilePic)}" alt="">`
      : `<div style="width:100%; height:100%; background:${color}; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:0.8rem;">${initials}</div>`;
      
    const status = targetUser.status || 'offline';
    const statusText = status.charAt(0).toUpperCase() + status.slice(1);
    
    const dotHtml = `<span class="status-dot status-dot--${status}" style="position:absolute; bottom:-2px; right:-2px; margin:0; width:10px; height:10px;"></span>`;
    
    // Desktop & Mobile use the same header in our updated design
    headerAvatar.innerHTML = `<div style="position:relative; width:100%; height:100%; border-radius:50%;">${avatarHtml}${dotHtml}</div>`;
    headerName.textContent = targetUser.username;
    headerStatus.innerHTML = statusText;
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
    
    const msgDate = new Date(msg.createdAt).toDateString();
    if (msgDate !== lastRenderedDate) {
      const dSep = document.createElement('div');
      dSep.className = 'date-separator';
      dSep.innerHTML = `<span>${msgDate === new Date().toDateString() ? 'Today' : msgDate}</span>`;
      messagesContainer.appendChild(dSep);
      lastRenderedDate = msgDate;
    }

    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper${isOwn ? ' message-wrapper--own' : ''}${grouped ? ' message-wrapper--grouped' : ''}`;
    wrapper.dataset.msgId = msg._id;

    if (!grouped && !isOwn) {
      const sender = document.createElement('div');
      sender.className = 'message-sender';
      sender.textContent = msg.username;
      wrapper.appendChild(sender);
    }

    if (msg.replySnapshot && msg.replySnapshot.username) {
      const quote = document.createElement('div');
      quote.className = 'reply-quote';
      quote.innerHTML = `<div class="reply-quote-author">${escapeHTML(msg.replySnapshot.username)}</div><div class="reply-quote-text">${escapeHTML(msg.replySnapshot.message)}</div>`;
      wrapper.appendChild(quote);
    }

    const bubble = document.createElement('div');
    bubble.className = `message-bubble${msg.deleted ? ' message-bubble--deleted' : ''}`;
    if (msg.deleted) {
      bubble.textContent = '🚫 Message deleted';
    } else {
      bubble.textContent = msg.message;
    }
    wrapper.appendChild(bubble);

    const timeRow = document.createElement('div');
    timeRow.className = 'message-time';
    timeRow.textContent = formatTime(msg.createdAt);
    if (msg.edited) {
      const lbl = document.createElement('span');
      lbl.className = 'msg-edited-label';
      lbl.textContent = '(edited)';
      timeRow.appendChild(lbl);
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

  function buildActionMenu(msg, isOwn, wrapper) {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    const reactBtn = document.createElement('button');
    reactBtn.type = 'button';
    reactBtn.className = 'msg-action-btn';
    reactBtn.innerHTML = '😊';
    reactBtn.title = 'React';
    reactBtn.addEventListener('click', () => {
      showReactionPicker(wrapper, msg._id);
    });
    actions.appendChild(reactBtn);

    const replyBtn = document.createElement('button');
    replyBtn.type = 'button';
    replyBtn.className = 'msg-action-btn';
    replyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>';
    replyBtn.title = 'Reply';
    replyBtn.addEventListener('click', () => {
      setReplyTo(msg);
    });
    actions.appendChild(replyBtn);

    if (isOwn && !msg.deleted) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'msg-action-btn';
      editBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
      editBtn.title = 'Edit';
      editBtn.addEventListener('click', () => {
        startInlineEdit(wrapper, msg);
      });
      actions.appendChild(editBtn);
    }

    if (isOwn && !msg.deleted) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'msg-action-btn';
      delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      delBtn.title = 'Delete';
      delBtn.addEventListener('click', () => {
        if (confirm('Delete this message?')) {
          if (socketRef) socketRef.emit('delete-message', { messageId: msg._id });
        }
      });
      actions.appendChild(delBtn);
    }
    return actions;
  }

  function showReactionPicker(wrapper, msgId) {
    document.querySelectorAll('.reaction-picker').forEach((p) => p.remove());
    const picker = document.createElement('div');
    picker.className = 'reaction-picker';
    EMOJIS.forEach((emoji) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'reaction-picker-emoji';
      btn.textContent = emoji;
      btn.addEventListener('click', () => {
        if (socketRef) socketRef.emit('react-message', { messageId: msgId, emoji });
        picker.remove();
      });
      picker.appendChild(btn);
    });
    wrapper.appendChild(picker);
    setTimeout(() => {
      document.addEventListener('click', function closePicker() {
        picker.remove();
        document.removeEventListener('click', closePicker);
      });
    }, 0);
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
      bubble.textContent = originalText;
    });
    saveBtn.addEventListener('click', () => {
      const newText = textarea.value.trim();
      if (!newText || newText === originalText) { cancelBtn.click(); return; }
      if (socketRef) socketRef.emit('edit-message', { messageId: msg._id, newText });
      bubble.textContent = newText;
      msg.message = newText;
    });
  }

  function shouldGroup(username, date) {
    if (username !== lastMessageUsername) return false;
    return new Date(date) - new Date(lastMessageTimestamp) < 60_000;
  }

  function updateEditedMessage({ _id, message }) {
    const wrapper = messagesContainer.querySelector(`[data-msg-id="${_id}"]`);
    if (!wrapper) return;
    const bubble = wrapper.querySelector('.message-bubble');
    if (!bubble || bubble.classList.contains('message-bubble--deleted')) return;
    bubble.textContent = message;
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

  // ── Connection status ─────────────────────────────────────────────────────
  function setStatus(state) {
    const labels = { connected: 'Connected', reconnecting: 'Reconnecting…', disconnected: 'Disconnected' };
    connectionText.textContent = labels[state] || state;
    if (state === 'connected') {
      connectionBanner.hidden = true;
      updateSendButton();
    } else {
      connectionBanner.hidden = false;
      connectionBanner.className = `connection-banner connection-banner--${state}`;
      sendBtn.disabled = true;
    }
  }

  // ── Socket.IO init ────────────────────────────────────────────────────────
  function initSocket() {
    const socket = io({
      reconnectionAttempts: Infinity,
      reconnectionDelay:    1000,
      reconnectionDelayMax: 5000,
    });
    socketRef = socket;

    socket.on('connect', () => {
      setStatus('connected');
      socket.emit('join-dm', { conversationId: conversation._id });
      loadMessages();
    });

    socket.on('disconnect',    () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('reconnecting'));

    socket.on('receive-dm', (msg) => {
      renderMessage(msg, false);
    });

    socket.on('message-edited',  (data) => updateEditedMessage(data));
    socket.on('message-deleted', (data) => updateDeletedMessage(data));
    socket.on('message-reacted', (data) => updateReactions(data));

    socket.on('user-status-changed', ({ userId, status }) => {
      if (String(userId) === String(targetUser._id)) {
        targetUser.status = status;
        updateHeader();
      }
    });

    socket.on('friend-request-received', ({ from }) => {
      showToast(`New friend request from ${escapeHTML(from.username)}`);
      if (typeof updateFriendBadge === 'function') updateFriendBadge();
    });

    socket.on('dm-notification', (msg) => {
      if (String(msg.userId) !== String(myUserId) && String(msg.conversationId) !== String(conversation._id)) {
        showToast(`New DM from ${escapeHTML(msg.username)}`);
      }
    });

    socket.on('error-message', ({ error }) => renderSystemMessage(`⚠ ${error}`));

    if (typeof registerWebrtcSockets === 'function') {
      registerWebrtcSockets(socket);
    }
  }

  async function loadMessages() {
    try {
      const res = await API.get(`/api/dm/conversations/${conversation._id}/messages`);
      messagesContainer.innerHTML = '';
      lastRenderedDate = null; lastMessageUsername = null; lastMessageTimestamp = null;
      res.messages.forEach(m => renderMessage(m, true));
      scrollToBottom();
    } catch (err) {
      console.error(err);
    }
  }

  // ── Reply handling ──────────────────────────────────────────────────────────
  function setReplyTo(msg) {
    replyToId = msg._id;
    replyPreviewAuthor.textContent = `Replying to ${msg.username}`;
    replyPreviewText.textContent = msg.deleted ? '🚫 Message deleted' : msg.message;
    replyPreviewBar.hidden = false;
    messageInput.focus();
  }

  function clearReply() {
    replyToId = null;
    replyPreviewBar.hidden = true;
    replyPreviewAuthor.textContent = '';
    replyPreviewText.textContent = '';
  }

  // ── Input & Submit ────────────────────────────────────────────────────────
  function updateSendButton() {
    sendBtn.disabled = !messageInput.value.trim() && !socketRef?.connected;
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  messageInput.addEventListener('input', () => {
    updateSendButton();
    const len = messageInput.value.length;
    if (charCounter) charCounter.textContent = `${len} / 500`;
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';

    if (!isTyping) {
      isTyping = true;
      if (socketRef) socketRef.emit('typing');
    }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isTyping = false;
      if (socketRef) socketRef.emit('stop-typing');
    }, 2000);
  });

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendBtn.click();
    }
  });

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value;
    if (!text || !socketRef) return;
    
    socketRef.emit('send-dm', {
      conversationId: conversation._id,
      message: text,
      replyToId
    });

    messageInput.value = '';
    messageInput.style.height = 'auto';
    if (charCounter) charCounter.textContent = '0 / 500';
    updateSendButton();
    clearReply();
    clearTimeout(typingTimeout);
    isTyping = false;
    socketRef.emit('stop-typing');
  });

  // ── WebRTC Implementation ──────────────────────────────────────────────────
  let peerConnection = null;
  let localStream = null;
  let callInterval = null;
  let callSeconds = 0;
  let isMuted = false;
  let inCall = false;

  const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  function formatDuration(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function startCallTimer() {
    clearInterval(callInterval);
    callSeconds = 0;
    callDurationEl.textContent = '00:00';
    callInterval = setInterval(() => {
      callSeconds++;
      callDurationEl.textContent = formatDuration(callSeconds);
    }, 1000);
  }

  function stopCallTimer() {
    clearInterval(callInterval);
  }

  function cleanupCall() {
    inCall = false;
    stopCallTimer();
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    activeCallWidget.hidden = true;
    incomingCallModal.hidden = true;
    remoteAudio.srcObject = null;
  }

  async function getLocalMedia() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      return true;
    } catch (err) {
      alert('Microphone access is required for calls.');
      return false;
    }
  }

  function createPeerConnection() {
    peerConnection = new RTCPeerConnection(ICE_SERVERS);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    
    peerConnection.ontrack = (event) => {
      remoteAudio.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef) {
        socketRef.emit('dm-call-ice-candidate', { targetUserId, candidate: event.candidate });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        callStatusText.textContent = 'Connected';
        callStatusText.style.color = '#10b981';
        startCallTimer();
      } else if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
        endCall();
      }
    };
  }

  function showActiveCallWidget() {
    activeCallWidget.hidden = false;
    callStatusText.textContent = 'Calling...';
    callStatusText.style.color = 'var(--accent-light)';
    callDurationEl.textContent = '00:00';
    isMuted = false;
    updateMicIcon();
  }

  function updateMicIcon() {
    if (isMuted) {
      micIcon.innerHTML = `<line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line>`;
      muteCallBtn.style.background = 'rgba(239, 68, 68, 0.15)';
      muteCallBtn.style.color = '#f87171';
    } else {
      micIcon.innerHTML = `<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>`;
      muteCallBtn.style.background = 'var(--bg-elevated)';
      muteCallBtn.style.color = 'var(--text-primary)';
    }
  }

  async function initiateCall() {
    if (inCall) return;
    if (!await getLocalMedia()) return;
    inCall = true;
    showActiveCallWidget();
    createPeerConnection();

    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socketRef.emit('dm-call-offer', { targetUserId, offer });
    } catch (err) {
      console.error('Call error:', err);
      cleanupCall();
    }
  }

  async function acceptCall(offer) {
    if (!await getLocalMedia()) {
      socketRef.emit('dm-call-rejected', { targetUserId });
      return;
    }
    incomingCallModal.hidden = true;
    inCall = true;
    showActiveCallWidget();
    createPeerConnection();

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socketRef.emit('dm-call-answer', { targetUserId, answer });
    } catch (err) {
      console.error('Answer error:', err);
      cleanupCall();
    }
  }

  function endCall() {
    if (!inCall) return;
    socketRef.emit('dm-call-ended', { targetUserId });
    cleanupCall();
    showToast('Call ended');
  }

  // Bind Buttons
  if (callBtn) callBtn.addEventListener('click', initiateCall);
  if (muteCallBtn) {
    muteCallBtn.addEventListener('click', () => {
      if (localStream) {
        isMuted = !isMuted;
        localStream.getAudioTracks()[0].enabled = !isMuted;
        updateMicIcon();
      }
    });
  }
  if (endCallBtn) endCallBtn.addEventListener('click', endCall);

  let pendingOffer = null;
  if (rejectCallBtn) {
    rejectCallBtn.addEventListener('click', () => {
      incomingCallModal.hidden = true;
      socketRef.emit('dm-call-rejected', { targetUserId });
      pendingOffer = null;
    });
  }
  if (acceptCallBtn) {
    acceptCallBtn.addEventListener('click', () => {
      if (pendingOffer) acceptCall(pendingOffer);
    });
  }

  // Socket Handlers
  window.registerWebrtcSockets = function(socket) {
    socket.on('dm-call-incoming', ({ callerName, offer }) => {
      if (inCall) {
        socket.emit('dm-call-rejected', { targetUserId });
        return;
      }
      pendingOffer = offer;
      incomingCallName.textContent = callerName;
      if (targetUser && targetUser.profilePic) {
        incomingCallAvatar.innerHTML = `<img src="${escapeHTML(targetUser.profilePic)}" alt="">`;
      } else {
        const color = avatarColor(callerName);
        const initials = escapeHTML(callerName.slice(0, 2).toUpperCase());
        incomingCallAvatar.innerHTML = `<div style="width:100%; height:100%; background:${color}; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:2rem;">${initials}</div>`;
      }
      incomingCallModal.hidden = false;
    });

    socket.on('dm-call-answered', async ({ answer }) => {
      if (!peerConnection) return;
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) { console.error('Set remote desc error:', err); }
    });

    socket.on('dm-call-ice-candidate', async ({ candidate }) => {
      if (!peerConnection) return;
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) { console.error('Add ICE candidate error:', err); }
    });

    socket.on('dm-call-rejected', () => {
      showToast('Call declined');
      cleanupCall();
    });

    socket.on('dm-call-ended', () => {
      if (inCall) showToast('Call ended');
      cleanupCall();
    });
  };

  init();
});
