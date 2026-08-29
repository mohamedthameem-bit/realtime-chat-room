/**
 * notifications.js - Handles fetching and rendering notifications
 */
(async function() {
  const listEl = document.getElementById('notifications-list');
  let notifications = [];

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    
    // If within 24 hours, show relative time
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      if (hours > 0) return `${hours}h ago`;
      if (minutes > 0) return `${minutes}m ago`;
      return 'Just now';
    }
    
    return d.toLocaleDateString();
  }

  function getNotificationUrl(n) {
    if (n.targetType === 'post' && n.targetId) return `/post.html?id=${n.targetId}`;
    if (n.targetType === 'reel' && n.targetId) return `/reels.html`;
    if (n.targetType === 'user' && n.sender?.username) return `/user-profile.html?username=${n.sender.username}`;
    if (n.type && (n.type.includes('follow') || n.type.includes('friend')) && n.sender?.username) {
      return `/user-profile.html?username=${n.sender.username}`;
    }
    return '#';
  }

  function renderNotifications() {
    if (notifications.length === 0) {
      listEl.innerHTML = `<div class="empty-state">No notifications yet.</div>`;
      return;
    }

    listEl.innerHTML = notifications.map(n => {
      const sender = n.sender || {};
      const avatarUrl = sender.profilePic || '';
      const fallbackInitials = (sender.username || 'Sys').substring(0, 2).toUpperCase();
      
      const avatarHTML = avatarUrl 
        ? `<img src="${escapeHTML(avatarUrl)}" class="notification-avatar" alt="Avatar" />`
        : `<div class="notification-avatar">${escapeHTML(fallbackInitials)}</div>`;

      let actionText = n.text ? escapeHTML(n.text) : '';
      if (!actionText) {
        switch (n.type) {
          case 'like_post': actionText = 'liked your post.'; break;
          case 'like_reel': actionText = 'liked your reel.'; break;
          case 'like_comment': actionText = 'liked your comment.'; break;
          case 'comment': actionText = 'commented on your post.'; break;
          case 'reply_comment': actionText = 'replied to your comment.'; break;
          case 'mention_post': actionText = 'mentioned you in a post.'; break;
          case 'mention_reel': actionText = 'mentioned you in a reel.'; break;
          case 'mention_comment': actionText = 'mentioned you in a comment.'; break;
          case 'follow': actionText = 'started following you.'; break;
          case 'friend_request': actionText = 'sent you a friend request.'; break;
          case 'friend_accepted': actionText = 'accepted your friend request.'; break;
          default: actionText = 'interacted with you.';
        }
      }

      const href = getNotificationUrl(n);
      const isUnread = !n.isRead;
      
      return `
        <a href="${href}" class="notification-item ${isUnread ? 'unread' : ''}" data-id="${n._id}">
          ${avatarHTML}
          <div class="notification-content">
            <div class="notification-text">
              <strong>${escapeHTML(sender.username || 'System')}</strong> ${actionText}
            </div>
            <div class="notification-time">${formatTime(n.createdAt)}</div>
          </div>
        </a>
      `;
    }).join('');
  }

  async function loadNotifications() {
    try {
      const res = await API.get('/api/notifications');
      notifications = res.notifications || [];
      renderNotifications();

      // Mark all as read after loading them
      const hasUnread = notifications.some(n => !n.isRead);
      if (hasUnread) {
        await API.patch('/api/notifications/read-all', {});
        // Update sidebar badge locally
        const badge = document.getElementById('nav-notifs-badge');
        if (badge) badge.style.display = 'none';
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
      listEl.innerHTML = `<div class="empty-state">Failed to load notifications.</div>`;
    }
  }

  // Start logic
  if (typeof API !== 'undefined') {
    loadNotifications();
  } else {
    listEl.innerHTML = `<div class="empty-state">API is not loaded.</div>`;
  }
})();
