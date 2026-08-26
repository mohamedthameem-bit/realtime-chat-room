/**
 * search.js — User search logic (Phase 6)
 */

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  const resultsContainer = document.getElementById('search-results');
  const emptyState = document.getElementById('search-empty');
  
  let debounceTimer;

  function avatarColor(name) {
    const palette = ['#6C63FF', '#3ECFCF', '#f472b6', '#fb923c', '#a3e635', '#facc15'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return palette[Math.abs(h) % palette.length];
  }
  
  function escapeHTML(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function performSearch(query) {
    if (!query) {
      resultsContainer.innerHTML = '';
      emptyState.hidden = true;
      return;
    }

    try {
      const res = await API.get(`/api/users/search?q=${encodeURIComponent(query)}`);
      
      resultsContainer.innerHTML = '';
      
      if (!res.users || res.users.length === 0) {
        emptyState.hidden = false;
        return;
      }
      
      emptyState.hidden = true;
      
      res.users.forEach(user => {
        const color = avatarColor(user.username);
        const initials = escapeHTML(user.username.slice(0, 2).toUpperCase());
        const avatarHtml = user.profilePic
          ? `<img src="${escapeHTML(user.profilePic)}" alt="">`
          : `<div style="width:100%; height:100%; background:${color}; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:1.5rem;">${initials}</div>`;
          
        const card = document.createElement('div');
        card.className = 'user-card';
        card.innerHTML = `
          <div class="user-card-avatar">
            ${avatarHtml}
            <span class="status-dot" data-status="${user.status || 'offline'}"></span>
          </div>
          <h3>${escapeHTML(user.username)}</h3>
          <p class="text-muted" style="font-size: 0.85rem; margin-top: 0.5rem; height: 40px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
            ${escapeHTML(user.bio || 'No bio provided.')}
          </p>
          <div class="user-card-actions">
            <a href="/user-profile.html?id=${user._id}" class="btn-ghost">Profile</a>
            <a href="/dm.html?with=${user._id}" class="btn-primary">Message</a>
          </div>
        `;
        resultsContainer.appendChild(card);
      });
      
    } catch (err) {
      console.error('Search failed:', err);
    }
  }

  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      performSearch(e.target.value.trim());
    }, 300);
  });
});
