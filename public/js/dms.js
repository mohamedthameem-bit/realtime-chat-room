/**
 * dms.js — List of Direct Messages (Phase 6)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const dmsList = document.getElementById('dms-list');
  const dmsEmpty = document.getElementById('dms-empty');
  
  function avatarColor(name) {
    const palette = ['#6C63FF', '#3ECFCF', '#f472b6', '#fb923c', '#a3e635', '#facc15'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return palette[Math.abs(h) % palette.length];
  }
  
  function escapeHTML(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatTime(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  try {
    const res = await API.get('/api/dm/conversations');
    const convs = res.conversations || [];
    
    if (convs.length === 0) {
      dmsEmpty.hidden = false;
      return;
    }
    
    convs.forEach(c => {
      const u = c.otherUser;
      if (!u) return;

      const color = avatarColor(u.username);
      const initials = escapeHTML(u.username.slice(0, 2).toUpperCase());
      const avatarHtml = u.profilePic
        ? `<img src="${escapeHTML(u.profilePic)}" alt="">`
        : `<div style="width:100%; height:100%; border-radius:50%; background:${color}; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold;">${initials}</div>`;

      let preview = 'No messages yet';
      let timeStr = formatTime(c.updatedAt);
      if (c.latestMessage) {
        preview = c.latestMessage.deleted ? '🚫 Message deleted' : escapeHTML(c.latestMessage.message);
        timeStr = formatTime(c.latestMessage.createdAt);
      }

      const card = document.createElement('a');
      card.href = `/dm.html?with=${u._id}`;
      card.className = 'dm-card';
      card.innerHTML = `
        <div class="user-avatar" style="position:relative; width:48px; height:48px; flex-shrink:0;">
          ${avatarHtml}
          <span class="status-dot" data-status="${u.status || 'offline'}" style="position:absolute; bottom:-2px; right:-2px; margin:0; width:12px; height:12px;"></span>
        </div>
        <div class="dm-card-info">
          <div class="dm-card-name">${escapeHTML(u.username)}</div>
          <div class="dm-card-preview">${preview}</div>
        </div>
        <div class="dm-card-meta">
          <div class="dm-card-time">${timeStr}</div>
          ${c.unreadCount > 0 ? `<span class="nav-badge" style="background:#a855f7; margin:0;">${c.unreadCount}</span>` : ''}
        </div>
      `;
      dmsList.appendChild(card);
    });
  } catch (err) {
    console.error(err);
  }
});
