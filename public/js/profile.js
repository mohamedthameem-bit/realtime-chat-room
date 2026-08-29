(function () {
  'use strict';

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function avatarColor(name) {
    const colors = ['#6C63FF','#3ECFCF','#f472b6','#fb923c','#a3e635','#facc15'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  }
  function letterAvatar(username, size = 150) {
    const color = avatarColor(username || 'U');
    const initials = (username || 'U').slice(0,2).toUpperCase();
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:${size*0.35}px;font-weight:700;color:#fff;">${escapeHTML(initials)}</div>`;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const targetUserId = urlParams.get('userId');

  let currentUser = null; // logged in user
  let profileUser = null; // user being viewed
  let isSelf = false;

  const avatarDisplay = document.getElementById('profile-avatar-display');
  const displayUsername = document.getElementById('display-username');
  const headerUsername = document.getElementById('header-username');
  const displayName = document.getElementById('display-name');
  const displayBio = document.getElementById('display-bio');
  const statPosts = document.getElementById('stat-posts');
  const statFollowers = document.getElementById('stat-followers');
  const statFollowing = document.getElementById('stat-following');
  const profileActions = document.getElementById('profile-actions');
  const highlightsTray = document.getElementById('highlights-tray');
  const contentGrid = document.getElementById('content-grid');
  const tabSaved = document.getElementById('tab-saved');

  // Edit Modal elements
  const editModal = document.getElementById('edit-profile-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const profileForm = document.getElementById('profile-form');
  const usernameInput = document.getElementById('profile-username');
  const nameInput = document.getElementById('profile-name');
  const bioInput = document.getElementById('profile-bio');
  const successDiv = document.getElementById('profile-success');
  const errorDiv = document.getElementById('profile-error');
  const saveBtn = document.getElementById('save-profile-btn');
  const signoutBtn = document.getElementById('signout-profile-btn');
  const avatarInput = document.getElementById('avatar-input');
  const avatarUploadLabel = document.getElementById('avatar-upload-label');

  function showSuccess(msg) { successDiv.textContent = msg; successDiv.hidden = false; errorDiv.hidden = true; }
  function showError(msg)   { errorDiv.textContent = msg;   errorDiv.hidden = false; successDiv.hidden = true; }
  function clearMessages()  { successDiv.hidden = true; errorDiv.hidden = true; }

  function renderAvatar(user, size = 150) {
    if (user.profilePic) {
      return `<img src="${escapeHTML(user.profilePic)}" alt="Avatar" class="profile-avatar" style="width:${size}px;height:${size}px;" />`;
    }
    return letterAvatar(user.username, size);
  }

  async function fetchStats(userId) {
    try {
      let followersCount = 0;
      let followingCount = 0;
      try {
        const followersRes = await API.get(`/api/follow/followers/${userId}`);
        followersCount = followersRes.followers ? followersRes.followers.length : 0;
      } catch (e) {}
      try {
        const followingRes = await API.get(`/api/follow/following/${userId}`);
        followingCount = followingRes.following ? followingRes.following.length : 0;
      } catch (e) {}

      statFollowers.textContent = followersCount;
      statFollowing.textContent = followingCount;
    } catch(e) {
      console.error('Error fetching stats', e);
    }
  }

  async function renderProfile() {
    avatarDisplay.innerHTML = renderAvatar(profileUser);
    displayUsername.textContent = profileUser.username;
    headerUsername.textContent = profileUser.username;
    displayName.textContent = profileUser.name || '';
    displayBio.textContent = profileUser.bio || '';

    profileActions.innerHTML = '';
    if (isSelf) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn-edit';
      editBtn.textContent = 'Edit Profile';
      editBtn.addEventListener('click', () => {
        // populate modal
        usernameInput.value = profileUser.username || '';
        nameInput.value = profileUser.name || '';
        bioInput.value = profileUser.bio || '';
        clearMessages();
        editModal.classList.add('active');
      });
      profileActions.appendChild(editBtn);

      avatarUploadLabel.style.display = 'block';
      tabSaved.style.display = 'flex';
    } else {
      const followBtn = document.createElement('button');
      followBtn.className = 'btn-follow';
      followBtn.textContent = 'Follow'; // Ideally we'd check follow status
      profileActions.appendChild(followBtn);

      avatarUploadLabel.style.display = 'none';
      tabSaved.style.display = 'none';
    }

    fetchStats(profileUser._id || profileUser.id);
  }

  async function fetchHighlights() {
    try {
      const id = profileUser._id || profileUser.id;
      const res = await API.get(`/api/highlights/user/${id}`);
      const highlights = res.highlights || (Array.isArray(res) ? res : []);
      if (highlights.length > 0) {
        highlightsTray.innerHTML = highlights.map(h => `
          <div class="highlight-item">
            <div class="highlight-cover">
              <img src="${escapeHTML(h.coverImage || '/img/default-highlight.png')}" alt="Highlight" />
            </div>
            <div class="highlight-title">${escapeHTML(h.title)}</div>
          </div>
        `).join('');
      } else {
        highlightsTray.innerHTML = '';
      }
    } catch (e) {
      console.error('Failed to fetch highlights', e);
      highlightsTray.innerHTML = '';
    }
  }

  async function fetchPosts() {
    contentGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px;">Loading posts...</div>';
    try {
      const id = profileUser._id || profileUser.id;
      const res = await API.get(`/api/posts/user/${id}`);
      const posts = res.posts || (Array.isArray(res) ? res : []);
      statPosts.textContent = posts.length;
      
      if (posts.length === 0) {
        contentGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--text-muted);">No posts yet.</div>';
        return;
      }

      contentGrid.innerHTML = posts.map(post => {
        const mediaUrl = post.mediaUrl || '';
        const isVideo = mediaUrl.match(/\.(mp4|webm|ogg)$/i);
        let mediaHtml = isVideo 
          ? `<video src="${escapeHTML(mediaUrl)}" muted loop></video>`
          : `<img src="${escapeHTML(mediaUrl)}" alt="Post" />`;
        
        return `<div class="grid-item">${mediaHtml}</div>`;
      }).join('');
    } catch (e) {
      console.error('Failed to fetch posts', e);
      contentGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--status-reconnecting);">Error loading posts.</div>';
    }
  }

  async function fetchReels() {
    contentGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px;">Loading reels...</div>';
    try {
      const id = profileUser._id || profileUser.id;
      const res = await API.get(`/api/reels/user/${id}`);
      const reels = res.reels || (Array.isArray(res) ? res : []);
      
      if (reels.length === 0) {
        contentGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--text-muted);">No reels yet.</div>';
        return;
      }

      contentGrid.innerHTML = reels.map(reel => `
        <div class="grid-item">
          <video src="${escapeHTML(reel.videoUrl)}" muted loop></video>
          <div style="position:absolute; top:5px; right:5px; color:#fff;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.error('Failed to fetch reels', e);
      contentGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--status-reconnecting);">Error loading reels.</div>';
    }
  }

  async function fetchSaved() {
    contentGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px;">Loading saved collections...</div>';
    try {
      const res = await API.get(`/api/saved-collections`);
      const collections = res.collections || (Array.isArray(res) ? res : []);
      
      if (collections.length === 0) {
        contentGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--text-muted);">No saved collections.</div>';
        return;
      }

      contentGrid.innerHTML = collections.map(col => `
        <div class="grid-item" style="display:flex; align-items:center; justify-content:center; background:var(--surface-3); font-weight:600; text-align: center; padding: 10px;">
          ${escapeHTML(col.name)}
        </div>
      `).join('');
    } catch (e) {
      console.error('Failed to fetch saved collections', e);
      contentGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--status-reconnecting);">Error loading saved collections.</div>';
    }
  }

  function handleTabClick(e) {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const tab = btn.dataset.tab;
    if (tab === 'posts') fetchPosts();
    else if (tab === 'reels') fetchReels();
    else if (tab === 'saved') fetchSaved();
  }

  document.querySelector('.profile-tabs').addEventListener('click', handleTabClick);

  // Avatar upload
  avatarInput.addEventListener('change', async () => {
    const file = avatarInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      // preview immediately
      const reader = new FileReader();
      reader.onload = (e) => {
        avatarDisplay.innerHTML = `<img src="${e.target.result}" alt="New avatar preview" class="profile-avatar" style="width:150px;height:150px;" />`;
      };
      reader.readAsDataURL(file);

      const data = await API.postForm('/api/profile/avatar', formData);
      currentUser.profilePic = data.profilePic;
      profileUser.profilePic = data.profilePic;
      avatarDisplay.innerHTML = renderAvatar(currentUser);
    } catch (err) {
      alert(`Avatar upload failed: ${err.message}`);
      avatarDisplay.innerHTML = renderAvatar(profileUser);
    }
  });

  // Modal actions
  closeModalBtn.addEventListener('click', () => {
    editModal.classList.remove('active');
  });

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const username = usernameInput.value.trim();
    const name = nameInput.value.trim();
    const bio = bioInput.value.trim();

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      const body = {};
      if (username) body.username = username;
      body.name = name;
      body.bio = bio;

      const data = await API.put('/api/profile', body);
      currentUser = data.user || currentUser;
      profileUser = data.user || profileUser;
      
      showSuccess('Profile saved successfully!');
      renderProfile();
      setTimeout(() => {
        editModal.classList.remove('active');
        saveBtn.textContent = 'Save Profile';
        saveBtn.disabled = false;
      }, 1000);
    } catch (err) {
      showError(err.message);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Profile';
    }
  });

  signoutBtn.addEventListener('click', async () => {
    try { await API.post('/api/auth/signout', {}); } catch (_) {}
    window.location.href = '/auth.html';
  });

  async function init() {
    try {
      currentUser = await API.whoami();
      if (!currentUser) { window.location.href = '/auth.html'; return; }

      if (!targetUserId || targetUserId === currentUser._id || targetUserId === currentUser.id) {
        isSelf = true;
        profileUser = currentUser;
      } else {
        isSelf = false;
        const res = await API.get(`/api/users/${targetUserId}`);
        profileUser = res.user;
      }

      await renderProfile();
      fetchHighlights();
      fetchPosts(); // Default active tab

    } catch (err) {
      console.error(err);
      alert('Error loading profile');
    }
  }

  init();
})();
