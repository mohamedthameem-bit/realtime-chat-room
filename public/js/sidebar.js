/**
 * sidebar.js — Persistent navigation sidebar component.
 *
 * Injected into every authenticated page via a single <script> tag.
 * Depends on api.js (the global `API` object) being loaded before this script.
 *
 * What this file does:
 *  1. Fetches the current user (API.whoami).
 *  2. Injects the sidebar + mobile topbar HTML into the page.
 *  3. Marks the active nav item from the current URL path.
 *  4. Wires up: mobile hamburger toggle, nav-link clicks (with chat leave),
 *     and the logout button (with confirmation modal).
 */

(function () {
  'use strict';

  // ── Shared icon set (Feather-style, consistent stroke-width=2) ──────────────
  const I = (d, extra = '') =>
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

  const ICONS = {
    home:    I('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
    create:  I('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>'),
    join:    I('<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>'),
    rooms:   I('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
    profile: I('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    logout:  I('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'),
    menu:    I('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>'),
    close:   I('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
    dms:     I('<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>'),
    search:  I('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
    friends: I('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    notifs:  I('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
  };

  const LOGO_SVG = `<svg class="snav-logo-svg" width="30" height="30" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <rect width="40" height="40" rx="10" fill="url(#snavGrad)"/>
    <path d="M10 13a3 3 0 013-3h14a3 3 0 013 3v10a3 3 0 01-3 3h-4l-5 5v-5h-5a3 3 0 01-3-3V13z" fill="white" fill-opacity="0.9"/>
    <defs><linearGradient id="snavGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
      <stop stop-color="#6C63FF"/><stop offset="1" stop-color="#3ECFCF"/>
    </linearGradient></defs>
  </svg>`;

  // ── Nav item definitions ────────────────────────────────────────────────────
  const NAV_ITEMS = [
    { id: 'home',    label: 'Feed',      href: '/feed.html',        icon: ICONS.home    },
    { id: 'explore', label: 'Explore',   href: '/explore.html',     icon: ICONS.search  },
    { id: 'reels',   label: 'Reels',     href: '/reels.html',       icon: ICONS.home    },
    { id: 'dms',     label: 'DMs',       href: '/dms.html',         icon: ICONS.dms     },
    { id: 'friends', label: 'Friends',   href: '/friends.html',     icon: ICONS.friends },
    { id: 'rooms',   label: 'Rooms',     href: '/rooms.html',       icon: ICONS.rooms   },
    { id: 'create',  label: 'Create',    href: '/create-post.html', icon: ICONS.create  },
    { id: 'notifs',  label: 'Notifications', href: '/notifications.html', icon: ICONS.notifs }, 
    { id: 'profile', label: 'Profile',   href: '/profile.html',     icon: ICONS.profile },
  ];

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function avatarColor(name) {
    const palette = ['#6C63FF', '#3ECFCF', '#f472b6', '#fb923c', '#a3e635', '#facc15'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return palette[Math.abs(h) % palette.length];
  }

  // ── Determine which nav item is active ──────────────────────────────────────
  function getActiveId() {
    const p = window.location.pathname;
    if (p === '/' || p === '/feed.html' || p === '/home.html') return 'home';
    if (p === '/explore.html' || p === '/search.html') return 'explore';
    if (p === '/reels.html' || p.startsWith('/reel.html')) return 'reels';
    if (p === '/create-post.html' || p === '/create-room.html') return 'create';
    if (p === '/profile.html' || p === '/edit-profile.html') return 'profile';
    if (p === '/rooms.html') return 'rooms';
    if (p === '/dms.html' || p === '/dm.html') return 'dms';
    if (p === '/friends.html' || p === '/close-friends.html') return 'friends';
    if (p === '/notifications.html') return 'notifs';
    return null;
  }

  // ── Build sidebar + topbar HTML ─────────────────────────────────────────────
  function buildHTML(user) {
    const activeId = getActiveId();
    const color    = avatarColor(user.username);
    const initials = escapeHTML(user.username.slice(0, 2).toUpperCase());

    const avatarHTML = user.profilePic
      ? `<img src="${escapeHTML(user.profilePic)}" alt="" class="snav-avatar-img" />`
      : `<div class="snav-avatar-letter" style="background:${color};" aria-hidden="true">${initials}</div>`;

    const navHTML = NAV_ITEMS.map(({ id, label, href, icon }) => {
      const isActive = activeId === id;
      let badgeHTML = '';
      if (id === 'friends') badgeHTML = `<span id="nav-friends-badge" class="nav-badge" style="display:none;">0</span>`;
      if (id === 'notifs') badgeHTML = `<span id="nav-notifs-badge" class="nav-badge" style="display:none;">0</span>`;

      return `<li class="snav-item">
        <a href="${href}"
           class="snav-link${isActive ? ' snav-link--active active' : ''}"
           data-nav-id="${id}"
           ${isActive ? 'aria-current="page"' : ''}>
           <span class="snav-icon">${icon}</span>
           <span class="snav-label">${label}</span>
           ${badgeHTML}
        </a>
      </li>`;
    }).join('');

    return `
      <!-- ── Mobile topbar ─────────────────────────────────── -->
      <div id="app-topbar" class="app-topbar" role="banner">
        <button id="app-hamburger" class="app-hamburger"
                aria-label="Open navigation menu"
                aria-expanded="false"
                aria-controls="app-sidebar">
          <span class="ham-icon">${ICONS.menu}</span>
          <span class="ham-close">${ICONS.close}</span>
        </button>
        <div class="app-topbar-brand">
          ${LOGO_SVG}
          <span class="app-topbar-title">ChatRoom</span>
        </div>
      </div>

      <!-- ── Overlay (mobile) ───────────────────────────────── -->
      <div id="app-sidebar-overlay" class="app-sidebar-overlay" aria-hidden="true"></div>

      <!-- ── Sidebar ───────────────────────────────────────── -->
      <nav id="app-sidebar" class="app-sidebar" aria-label="Main navigation">

        <!-- Brand (desktop only) -->
        <div class="snav-brand">
          ${LOGO_SVG}
          <span class="snav-brand-name">ChatRoom</span>
        </div>

        <!-- Signed-in user -->
        <div class="snav-user snav-status-picker" id="snav-status-picker">
          <div class="snav-user-avatar">${avatarHTML}</div>
          <div class="snav-user-info">
            <span class="snav-user-name" title="${escapeHTML(user.username)}">${escapeHTML(user.username)}</span>
            <span class="snav-user-online">
              <span class="status-dot" id="snav-status-dot" data-status="${user.status || 'online'}"></span>
              <span id="snav-status-text">${(user.status || 'online').charAt(0).toUpperCase() + (user.status || 'online').slice(1)}</span>
            </span>
          </div>
          <div class="snav-status-dropdown" id="snav-status-dropdown">
            <button class="status-option" data-status="online"><span class="status-dot" data-status="online"></span> Online</button>
            <button class="status-option" data-status="away"><span class="status-dot" data-status="away"></span> Away</button>
            <button class="status-option" data-status="busy"><span class="status-dot" data-status="busy"></span> Busy</button>
            <button class="status-option" data-status="invisible"><span class="status-dot" data-status="invisible"></span> Invisible</button>
          </div>
        </div>

        <!-- Nav links -->
        <ul class="snav-list" role="list">${navHTML}</ul>

        <!-- Logout -->
        <div class="snav-footer">
          <button id="snav-logout" class="snav-link snav-logout-btn" type="button"
                  aria-label="Sign out of ChatRoom">
            <span class="snav-icon">${ICONS.logout}</span>
            <span class="snav-label">Logout</span>
          </button>
        </div>
      </nav>

      <!-- ── Logout confirmation modal ─────────────────────── -->
      <div id="snav-modal" class="snav-modal-backdrop" role="dialog"
           aria-modal="true" aria-labelledby="snav-modal-title" hidden>
        <div class="snav-modal-card">
          <h2 class="snav-modal-title" id="snav-modal-title">Sign out?</h2>
          <p class="snav-modal-body">You'll need to sign in again to access your rooms.</p>
          <div class="snav-modal-actions">
            <button id="snav-modal-cancel" class="btn-ghost">Cancel</button>
            <button id="snav-modal-confirm" class="btn-leave">Sign Out</button>
          </div>
        </div>
      </div>
    `;
  }

  // ── Inject into page ─────────────────────────────────────────────────────────
  function inject(user) {
    const root = document.createElement('div');
    root.id    = 'app-nav-root';
    root.innerHTML = buildHTML(user);
    document.body.prepend(root);
    document.body.classList.add('has-sidebar');
  }

  // ── Mobile sidebar toggle ────────────────────────────────────────────────────
  function initMobileToggle() {
    const hamburger = document.getElementById('app-hamburger');
    const overlay   = document.getElementById('app-sidebar-overlay');

    function open() {
      document.body.classList.add('nav-sidebar-open');
      hamburger.setAttribute('aria-expanded', 'true');
      overlay.setAttribute('aria-hidden', 'false');
    }
    function close() {
      document.body.classList.remove('nav-sidebar-open');
      hamburger.setAttribute('aria-expanded', 'false');
      overlay.setAttribute('aria-hidden', 'true');
    }

    hamburger.addEventListener('click', () =>
      document.body.classList.contains('nav-sidebar-open') ? close() : open()
    );
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('nav-sidebar-open')) close();
    });

    // Close on any nav link click (tapping a link on mobile should close the sidebar first)
    document.querySelectorAll('#app-sidebar .snav-link[href]').forEach(link =>
      link.addEventListener('click', close)
    );
  }

  // ── Chat page: clean room leave before navigating away ───────────────────────
  // chat.js sets window.__chatLeave = async function() { ... }
  // so we can call it here without any direct coupling.
  async function maybeLeaveChat() {
    if (typeof window.__chatLeave === 'function') {
      try { await window.__chatLeave(); } catch (_) {}
    }
  }

  // ── Nav link clicks (intercept on chat page to leave cleanly) ───────────────
  function initNavigation() {
    document.querySelectorAll('#app-sidebar .snav-link[data-nav-id]').forEach(link => {
      link.addEventListener('click', async (e) => {
        const href = link.getAttribute('href');
        if (!href) return;

        // Only intercept if on the chat page — otherwise default browser navigation
        if (window.location.pathname.includes('chat.html')) {
          e.preventDefault();
          await maybeLeaveChat();
          window.location.href = href;
        }
        // Non-chat pages: let the default <a> navigation happen
      });
    });
  }

  // ── Logout modal ─────────────────────────────────────────────────────────────
  function initLogout() {
    const logoutBtn    = document.getElementById('snav-logout');
    const modal        = document.getElementById('snav-modal');
    const cancelBtn    = document.getElementById('snav-modal-cancel');
    const confirmBtn   = document.getElementById('snav-modal-confirm');

    function openModal()  { modal.hidden = false; cancelBtn.focus(); }
    function closeModal() { modal.hidden = true; }

    logoutBtn.addEventListener('click', openModal);
    cancelBtn.addEventListener('click', closeModal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });

    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Signing out…';

      // Leave any active chat room first
      await maybeLeaveChat();

      // Clear the JWT cookie via API
      try { await API.post('/api/auth/signout', {}); } catch (_) {}

      window.location.href = '/auth.html';
    });
  }

  // ── Status Picker ────────────────────────────────────────────────────────────
  function initStatusPicker() {
    const picker = document.getElementById('snav-status-picker');
    const dropdown = document.getElementById('snav-status-dropdown');
    const dot = document.getElementById('snav-status-dot');
    const text = document.getElementById('snav-status-text');

    if (!picker || !dropdown) return;

    picker.addEventListener('click', (e) => {
      // Toggle if clicking the picker area, but not if clicking an option
      if (!e.target.closest('.status-option')) {
        dropdown.classList.toggle('show');
      }
    });

    document.addEventListener('click', (e) => {
      if (!picker.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    });

    dropdown.querySelectorAll('.status-option').forEach(opt => {
      opt.addEventListener('click', async (e) => {
        const newStatus = opt.getAttribute('data-status');
        dot.setAttribute('data-status', newStatus);
        text.textContent = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
        dropdown.classList.remove('show');
        
        try {
          await API.patch('/api/profile/status', { status: newStatus });
        } catch (err) {
          console.error('Failed to update status', err);
        }
      });
    });
  }

  // ── Fetch Friend Requests Badge ───────────────────────────────────────────────
  async function updateFriendBadge() {
    const badge = document.getElementById('nav-friends-badge');
    if (!badge) return;
    try {
      const res = await API.get('/api/friends/requests');
      const count = res.requests.length;
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    } catch (err) {}
  }

  // ── Fetch Notifications Badge ───────────────────────────────────────────────
  async function updateNotifsBadge() {
    const badge = document.getElementById('nav-notifs-badge');
    if (!badge) return;
    try {
      let count = 0;
      try {
        const res = await API.get('/api/notifications/unread-count');
        count = res.count || 0;
      } catch (e) {
        // Fallback
        const res2 = await API.get('/api/notifications');
        if (res2.notifications) {
          count = res2.notifications.filter(n => !n.isRead).length;
        }
      }
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    } catch (err) {}
  }

  // ── Socket.IO Real-time Notifications ───────────────────────────────────────
  function initRealtime() {
    // If socket.io isn't loaded on this page, dynamically load it
    if (typeof io === 'undefined') {
      const script = document.createElement('script');
      script.src = '/socket.io/socket.io.js';
      script.onload = () => setupGlobalSocket();
      document.head.appendChild(script);
    } else {
      setupGlobalSocket();
    }
  }

  function setupGlobalSocket() {
    // We only need a single socket connection per page. If window.globalSocket exists, use it.
    if (!window.globalSocket) {
      window.globalSocket = io({ reconnection: true });
    }
    
    window.globalSocket.on('new_notification', () => updateNotifsBadge());
    window.globalSocket.on('new-notification', () => updateNotifsBadge());

    window.globalSocket.on('friend-request-received', () => {
      updateFriendBadge();
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  async function init() {
    if (typeof API === 'undefined') {
      console.error('[Sidebar] api.js must be loaded before sidebar.js');
      return;
    }

    const user = await API.whoami();
    if (!user) return; // Unauthenticated — don't render (auth page will handle)

    inject(user);
    initMobileToggle();
    initNavigation();
    initLogout();
    initStatusPicker();
    updateFriendBadge();
    updateNotifsBadge();
    initRealtime();

    // Re-check badge every 30 seconds
    setInterval(() => {
      updateFriendBadge();
      updateNotifsBadge();
    }, 30000);
  }

  init();
})();
