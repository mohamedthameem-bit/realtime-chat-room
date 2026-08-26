/**
 * user-profile.js — Public profile view (Phase 6)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const content = document.getElementById('profile-content');
  const loading = document.getElementById('profile-loading');
  
  const params = new URLSearchParams(window.location.search);
  const targetUserId = params.get('id');
  
  if (!targetUserId) {
    loading.textContent = 'User ID not provided.';
    return;
  }

  function avatarColor(name) {
    const palette = ['#6C63FF', '#3ECFCF', '#f472b6', '#fb923c', '#a3e635', '#facc15'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return palette[Math.abs(h) % palette.length];
  }
  
  function escapeHTML(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  try {
    const [profileRes, friendsRes] = await Promise.all([
      API.get(`/api/users/${targetUserId}`),
      API.get('/api/friends')
    ]);
    
    const user = profileRes.user;
    const myFriends = friendsRes.friends || [];
    const isFriend = myFriends.some(f => String(f._id) === String(user._id));
    
    // Also check if we have a pending request (this would require another endpoint, but we can simplify by just sending a request and handling the 'already sent' error)
    
    loading.style.display = 'none';
    
    const color = avatarColor(user.username);
    const initials = escapeHTML(user.username.slice(0, 2).toUpperCase());
    const avatarHtml = user.profilePic
      ? `<img src="${escapeHTML(user.profilePic)}" alt="">`
      : `<div style="width:100%; height:100%; border-radius:50%; background:${color}; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:3rem;">${initials}</div>`;

    const joinedDate = new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    let friendBtnHtml = `<button id="btn-add-friend" class="btn-primary">Add Friend</button>`;
    if (isFriend) {
      friendBtnHtml = `<button class="btn-ghost" disabled style="opacity: 0.8; cursor: default;">Friends ✓</button>`;
    }

    content.innerHTML = `
      <div class="profile-avatar">
        ${avatarHtml}
        <span class="status-dot" data-status="${user.status || 'offline'}"></span>
      </div>
      <h1 class="profile-name">${escapeHTML(user.username)}</h1>
      <p class="profile-bio">${escapeHTML(user.bio || 'No bio provided.')}</p>
      
      <div class="profile-meta">
        <div class="profile-meta-item">
          <span class="profile-meta-value">${user.friendCount}</span>
          <span>Friends</span>
        </div>
        <div class="profile-meta-item">
          <span class="profile-meta-value">${joinedDate}</span>
          <span>Joined</span>
        </div>
      </div>
      
      <div class="profile-actions">
        ${friendBtnHtml}
        <a href="/dm.html?with=${user._id}" class="btn-primary" style="background: var(--bg-surface); border: 1px solid var(--border-color);">Message</a>
      </div>
    `;
    
    content.style.display = 'block';

    if (!isFriend) {
      const addBtn = document.getElementById('btn-add-friend');
      addBtn.addEventListener('click', async () => {
        try {
          addBtn.disabled = true;
          addBtn.textContent = 'Sending...';
          await API.post('/api/friends/request', { targetUserId: user._id });
          addBtn.textContent = 'Request Sent';
          addBtn.className = 'btn-ghost';
        } catch (err) {
          alert(err.message || 'Failed to send request.');
          addBtn.disabled = false;
          addBtn.textContent = 'Add Friend';
        }
      });
    }

  } catch (err) {
    loading.textContent = err.message || 'Failed to load profile.';
  }
});
