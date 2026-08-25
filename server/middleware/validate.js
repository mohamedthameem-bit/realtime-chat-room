/**
 * validate.js — Shared validation helpers used by both REST routes and Socket.IO handlers.
 * Phase 2 adds: validateAuthUsername, validatePassword, validateRoomName, validateBio.
 */

// ── Phase 1 validators (unchanged) ────────────────────────────────────────────

// Username for chat presence: 2–20 chars, alphanumeric + spaces + hyphens
const CHAT_USERNAME_REGEX = /^[a-zA-Z0-9 -]{2,20}$/;

function validateUsername(username) {
  if (typeof username !== 'string') return { valid: false, error: 'Username must be a string.' };
  const t = username.trim();
  if (!t)          return { valid: false, error: 'Username is required.' };
  if (t.length < 2)  return { valid: false, error: 'Username must be at least 2 characters.' };
  if (t.length > 20) return { valid: false, error: 'Username cannot exceed 20 characters.' };
  if (!CHAT_USERNAME_REGEX.test(t)) {
    return { valid: false, error: 'Username may only contain letters, numbers, spaces, and hyphens.' };
  }
  return { valid: true };
}

function validateMessage(message) {
  if (typeof message !== 'string') return { valid: false, error: 'Message must be a string.' };
  const t = message.trim();
  if (!t)          return { valid: false, error: 'Message cannot be empty.' };
  if (t.length > 500) return { valid: false, error: 'Message cannot exceed 500 characters.' };
  return { valid: true };
}

function sanitizeRoom(room) {
  if (typeof room !== 'string' || !room.trim()) return 'general';
  return room.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40);
}

// ── Phase 2 validators ─────────────────────────────────────────────────────────

// Auth username: 3–20 chars, alphanumeric + underscores + hyphens (no spaces)
const AUTH_USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

/**
 * Validate a username for sign-up / profile update.
 * More strict than the chat-presence username (no spaces allowed).
 */
function validateAuthUsername(username) {
  if (typeof username !== 'string') return { valid: false, error: 'Username must be a string.' };
  const t = username.trim();
  if (!t)           return { valid: false, error: 'Username is required.' };
  if (t.length < 3)  return { valid: false, error: 'Username must be at least 3 characters.' };
  if (t.length > 20) return { valid: false, error: 'Username cannot exceed 20 characters.' };
  if (!AUTH_USERNAME_REGEX.test(t)) {
    return { valid: false, error: 'Username may only contain letters, numbers, underscores, and hyphens.' };
  }
  return { valid: true };
}

/**
 * Validate a password for sign-up.
 * Minimum 8 characters, at least one letter and one number.
 */
function validatePassword(password) {
  if (typeof password !== 'string') return { valid: false, error: 'Password must be a string.' };
  if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters.' };
  if (!/[a-zA-Z]/.test(password)) return { valid: false, error: 'Password must contain at least one letter.' };
  if (!/[0-9]/.test(password))    return { valid: false, error: 'Password must contain at least one number.' };
  return { valid: true };
}

/**
 * Validate a room name for creation.
 * 3–30 characters.
 */
function validateRoomName(name) {
  if (typeof name !== 'string') return { valid: false, error: 'Room name must be a string.' };
  const t = name.trim();
  if (!t)           return { valid: false, error: 'Room name is required.' };
  if (t.length < 3)  return { valid: false, error: 'Room name must be at least 3 characters.' };
  if (t.length > 30) return { valid: false, error: 'Room name cannot exceed 30 characters.' };
  return { valid: true };
}

/**
 * Validate a bio for profile updates.
 * Optional but max 150 characters.
 */
function validateBio(bio) {
  if (typeof bio !== 'string') return { valid: false, error: 'Bio must be a string.' };
  if (bio.trim().length > 150) return { valid: false, error: 'Bio cannot exceed 150 characters.' };
  return { valid: true };
}

/**
 * Validate a room password (for private rooms).
 * Minimum 4 characters.
 */
function validateRoomPassword(password) {
  if (typeof password !== 'string') return { valid: false, error: 'Room password must be a string.' };
  if (password.length < 4) return { valid: false, error: 'Room password must be at least 4 characters.' };
  return { valid: true };
}

module.exports = {
  // Phase 1
  validateUsername,
  validateMessage,
  sanitizeRoom,
  // Phase 2
  validateAuthUsername,
  validatePassword,
  validateRoomName,
  validateBio,
  validateRoomPassword,
};
