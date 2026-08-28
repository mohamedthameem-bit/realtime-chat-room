/**
 * close-friends.js — Manage Close Friends list.
 */

(function () {
  'use strict';

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/`/g, '&#x60;');
  }

  function avatarColor(name) {
    const colors = ['#6C63FF', '#3ECFCF', '#f472b6', '#fb923c', '#a3e635', '#facc15'];
    let h = 0;
    for (let i = 0; i < name.length; i++) {
      h = name.charCodeAt(i) + ((h << 5) - h);
    }
    return colors[Math.abs(h) % colors.length];
  }

  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('toast--show');
    });
    
    setTimeout(() => {
      toast.classList.remove('toast--show');
      toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
  }

  const listContainer = document.getElementById('close-friends-list');
  const searchInput = document.getElementById('search-input');
  const saveBtn = document.getElementById('save-btn');

  let followers = [];
  let closeFriendsIds = new Set();
  let originalCloseFriendsIds = new Set();

  async function loadData() {
    try {
      listContainer.innerHTML = '<div class="loader">Loading...</div>';
      
      const user = await API.get('/api/auth/me');
      
      // Get followers
      const followersRes = await API.get(`/api/follow/followers/${user._id}`);
      followers = followersRes.followers || [];

      // Get current close friends
      const cfRes = await API.get('/api/follow/close-friends');
      const closeFriends = cfRes.closeFriends || [];
      
      closeFriends.forEach(cf => {
        closeFriendsIds.add(cf._id);
        originalCloseFriendsIds.add(cf._id);
      });

      renderList();
    } catch (err) {
      listContainer.innerHTML = `<div class="error-text">Failed to load data: ${escapeHTML(err.message)}</div>`;
    }
  }

  function renderList(searchQuery = '') {
    listContainer.innerHTML = '';
    
    const query = searchQuery.toLowerCase().trim();
    const filteredFollowers = followers.filter(f => 
      f.username.toLowerCase().includes(query) || 
      (f.name && f.name.toLowerCase().includes(query))
    );

    if (filteredFollowers.length === 0) {
      if (query) {
        listContainer.innerHTML = '<div class="empty-state">No followers match your search.</div>';
      } else {
        listContainer.innerHTML = '<div class="empty-state">You have no followers yet.</div>';
      }
      return;
    }

    filteredFollowers.forEach(f => {
      const isSelected = closeFriendsIds.has(f._id);
      
      const item = document.createElement('div');
      item.className = 'user-item';
      item.style.cursor = 'pointer';
      item.style.padding = '0.75rem';
      item.style.borderRadius = 'var(--radius-md)';
      item.style.transition = 'background-color var(--transition-fast)';
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      
      item.addEventListener('mouseenter', () => { item.style.backgroundColor = 'var(--surface-hover)'; });
      item.addEventListener('mouseleave', () => { item.style.backgroundColor = 'transparent'; });
      
      let avatarHtml = '';
      if (f.profilePic) {
        avatarHtml = `<img src="${escapeHTML(f.profilePic)}" alt="" />`;
      } else {
        const color = avatarColor(f.username);
        const initials = escapeHTML(f.username.slice(0, 2).toUpperCase());
        avatarHtml = `<div style="width: 100%; height: 100%; background: ${color}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1rem;">${initials}</div>`;
      }
      
      const checkboxHtml = `
        <div style="width: 24px; height: 24px; border-radius: 50%; border: 2px solid ${isSelected ? 'var(--primary)' : 'var(--text-secondary)'}; background: ${isSelected ? 'var(--primary)' : 'transparent'}; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
          ${isSelected ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
        </div>
      `;

      item.innerHTML = `
        <div class="user-item-avatar">${avatarHtml}</div>
        <div class="user-item-text" style="flex: 1;">
          <div class="user-item-name">${escapeHTML(f.username)}${f.isVerified ? ' <span style="color:var(--primary); font-size:0.8rem;">✓</span>' : ''}</div>
          ${f.name ? `<div class="user-item-status" style="color: var(--text-secondary);">${escapeHTML(f.name)}</div>` : ''}
        </div>
        ${checkboxHtml}
      `;
      
      item.addEventListener('click', () => {
        if (closeFriendsIds.has(f._id)) {
          closeFriendsIds.delete(f._id);
        } else {
          closeFriendsIds.add(f._id);
        }
        checkChanges();
        renderList(searchInput.value);
      });
      
      listContainer.appendChild(item);
    });
  }

  function checkChanges() {
    let changed = false;
    if (closeFriendsIds.size !== originalCloseFriendsIds.size) {
      changed = true;
    } else {
      for (const id of closeFriendsIds) {
        if (!originalCloseFriendsIds.has(id)) {
          changed = true;
          break;
        }
      }
    }
    saveBtn.disabled = !changed;
  }

  searchInput.addEventListener('input', (e) => {
    renderList(e.target.value);
  });

  saveBtn.addEventListener('click', async () => {
    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      
      const ids = Array.from(closeFriendsIds);
      await API.patch('/api/follow/close-friends', { ids });
      
      originalCloseFriendsIds = new Set(closeFriendsIds);
      showToast('Close Friends list updated');
      checkChanges();
      
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      saveBtn.textContent = 'Save Changes';
      if (!saveBtn.disabled) checkChanges(); // Re-evaluate if it should be disabled
    }
  });

  loadData();

})();
