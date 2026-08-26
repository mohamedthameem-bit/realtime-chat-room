/**
 * friends.js — Friends & Requests management (Phase 6)
 */

document.addEventListener('DOMContentLoaded', () => {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const friendsGrid = document.getElementById('friends-grid');
  const friendsEmpty = document.getElementById('friends-empty');
  const requestsList = document.getElementById('requests-list');
  const requestsEmpty = document.getElementById('requests-empty');
  const localBadge = document.getElementById('local-requests-badge');

  function avatarColor(name) {
    const palette = ['#6C63FF', '#3ECFCF', '#f472b6', '#fb923c', '#a3e635', '#facc15'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return palette[Math.abs(h) % palette.length];
  }
  
  function escapeHTML(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Tabs
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  async function loadFriends() {
    try {
      const res = await API.get('/api/friends');
      const friends = res.friends || [];
      
      friendsGrid.innerHTML = '';
      if (friends.length === 0) {
        friendsEmpty.hidden = false;
        return;
      }
      friendsEmpty.hidden = true;

      friends.forEach(f => {
        const color = avatarColor(f.username);
        const initials = escapeHTML(f.username.slice(0, 2).toUpperCase());
        const avatarHtml = f.profilePic
          ? `<img src="${escapeHTML(f.profilePic)}" alt="">`
          : `<div style="width:100%; height:100%; background:${color}; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:1.5rem;">${initials}</div>`;
          
        const card = document.createElement('div');
        card.className = 'user-card';
        card.innerHTML = `
          <div class="user-card-avatar">
            ${avatarHtml}
            <span class="status-dot" data-status="${f.status || 'offline'}"></span>
          </div>
          <h3>${escapeHTML(f.username)}</h3>
          <div class="user-card-actions">
            <a href="/dm.html?with=${f._id}" class="btn-primary">Message</a>
            <button class="btn-ghost btn-remove" data-id="${f._id}">Remove</button>
          </div>
        `;
        
        card.querySelector('.btn-remove').addEventListener('click', async () => {
          if (confirm(`Remove ${f.username} from friends?`)) {
            await API.delete(`/api/friends/${f._id}`);
            loadFriends();
          }
        });

        friendsGrid.appendChild(card);
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function loadRequests() {
    try {
      const res = await API.get('/api/friends/requests');
      const requests = res.requests || [];
      
      requestsList.innerHTML = '';
      if (requests.length === 0) {
        requestsEmpty.hidden = false;
        localBadge.style.display = 'none';
        return;
      }
      requestsEmpty.hidden = true;
      localBadge.textContent = requests.length;
      localBadge.style.display = 'inline-block';

      requests.forEach(req => {
        const u = req.from;
        const color = avatarColor(u.username);
        const initials = escapeHTML(u.username.slice(0, 2).toUpperCase());
        const avatarHtml = u.profilePic
          ? `<img src="${escapeHTML(u.profilePic)}" alt="">`
          : `<div style="width:100%; height:100%; background:${color}; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold;">${initials}</div>`;

        const card = document.createElement('div');
        card.className = 'request-card';
        card.innerHTML = `
          <div class="request-user">
            <div class="request-avatar">
              ${avatarHtml}
            </div>
            <div>
              <div style="font-weight: bold;">${escapeHTML(u.username)}</div>
            </div>
          </div>
          <div class="request-actions">
            <button class="btn-ghost btn-decline" data-id="${req._id}">Decline</button>
            <button class="btn-primary btn-accept" data-id="${req._id}">Accept</button>
          </div>
        `;

        card.querySelector('.btn-accept').addEventListener('click', async () => {
          await API.post('/api/friends/accept', { requestId: req._id });
          loadRequests();
          loadFriends();
          if (typeof window.updateFriendBadge === 'function') window.updateFriendBadge();
        });

        card.querySelector('.btn-decline').addEventListener('click', async () => {
          await API.post('/api/friends/decline', { requestId: req._id });
          loadRequests();
          if (typeof window.updateFriendBadge === 'function') window.updateFriendBadge();
        });

        requestsList.appendChild(card);
      });
    } catch (err) {
      console.error(err);
    }
  }

  loadFriends();
  loadRequests();
});
