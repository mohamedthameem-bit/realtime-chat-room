/**
 * api.js — Shared fetch wrapper for all pages.
 *
 * - Always sends cookies (credentials: 'include')
 * - On 401 responses, redirects to auth.html
 * - Returns parsed JSON or throws an error with a user-facing message
 */

const API = (() => {
  /**
   * Core fetch wrapper.
   * @param {string} url
   * @param {object} options - fetch options (method, body, etc.)
   * @returns {Promise<object>} — parsed response JSON
   */
  async function request(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      credentials: 'include', // Always send the JWT cookie
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    // Redirect to sign-in on unauthenticated responses
    if (res.status === 401) {
      // Avoid infinite redirect loop on the auth page itself
      if (!window.location.pathname.includes('auth.html')) {
        window.location.href = '/auth.html';
      }
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Authentication required.');
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || `Request failed (${res.status})`);
    }

    return data;
  }

  return {
    get:  (url)          => request(url, { method: 'GET' }),
    post: (url, body)    => request(url, { method: 'POST', body: JSON.stringify(body) }),
    put:  (url, body)    => request(url, { method: 'PUT',  body: JSON.stringify(body) }),

    /**
     * POST with FormData (for file uploads — no Content-Type override).
     */
    postForm: (url, formData) => fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }).then(async (res) => {
      if (res.status === 401) {
        window.location.href = '/auth.html';
        throw new Error('Authentication required.');
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Upload failed (${res.status})`);
      return data;
    }),

    /**
     * Check if the user is signed in. Returns user object or null.
     */
    async whoami() {
      try {
        const data = await request('/api/auth/me');
        return data.user;
      } catch {
        return null;
      }
    },
  };
})();
