/**
 * profileController.js — User profile view and update endpoints.
 */

const path = require('path');
const fs   = require('fs');
const User = require('../models/User');
const { validateAuthUsername, validateBio } = require('../middleware/validate');

// ── Get Profile ───────────────────────────────────────────────────────────────

/**
 * GET /api/profile
 * Returns the authenticated user's full profile.
 */
function getProfile(req, res) {
  // req.user is set by requireAuth (already a lean object)
  const { _id, username, name, bio, profilePic, createdAt } = req.user;
  return res.json({
    success: true,
    user: { _id, username, name, bio, profilePic, createdAt },
  });
}

// ── Update Profile ────────────────────────────────────────────────────────────

/**
 * PUT /api/profile
 * Body: { username?, name?, bio? }
 * Saves changes (excluding profilePic — that goes through /avatar).
 */
async function updateProfile(req, res, next) {
  try {
    const { username, name, bio } = req.body;
    const userId = req.user._id;

    const updates = {};

    // Username — optional change, but must be unique if provided
    if (username !== undefined) {
      const uCheck = validateAuthUsername(username);
      if (!uCheck.valid) {
        return res.status(400).json({ success: false, message: uCheck.error });
      }

      const trimmed = username.trim();

      // Check uniqueness (skip if it's the same as current)
      if (trimmed.toLowerCase() !== req.user.username.toLowerCase()) {
        const existing = await User.findOne({
          username: { $regex: new RegExp(`^${trimmed}$`, 'i') },
          _id: { $ne: userId },
        });
        if (existing) {
          return res.status(409).json({ success: false, message: 'That username is already taken.' });
        }
      }
      updates.username = trimmed;
    }

    // Name — optional display name
    if (name !== undefined) {
      const trimmed = String(name).trim().slice(0, 40);
      updates.name = trimmed;
    }

    // Bio
    if (bio !== undefined) {
      const bioCheck = validateBio(bio);
      if (!bioCheck.valid) {
        return res.status(400).json({ success: false, message: bioCheck.error });
      }
      updates.bio = String(bio).trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    const updated = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true }).lean();

    const { passwordHash: _, ...publicUser } = updated;
    return res.json({ success: true, user: publicUser });
  } catch (err) {
    next(err);
  }
}

// ── Upload Avatar ─────────────────────────────────────────────────────────────

/**
 * POST /api/profile/avatar
 * Expects a multipart/form-data field named "avatar".
 * File is stored under /uploads/avatars/ with a unique filename.
 * multer is configured in the route file.
 */
async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const userId = req.user._id;

    // Build the public URL path (Express serves /uploads statically)
    const publicPath = `/uploads/avatars/${req.file.filename}`;

    // If the user had a previous avatar, delete the old file from disk
    if (req.user.profilePic) {
      const oldPath = path.join(__dirname, '..', '..', req.user.profilePic);
      fs.unlink(oldPath, (err) => {
        // Non-fatal — log and continue
        if (err && err.code !== 'ENOENT') {
          console.warn('[Profile] Failed to delete old avatar:', err.message);
        }
      });
    }

    // Save the new path in the DB
    const updated = await User.findByIdAndUpdate(
      userId,
      { profilePic: publicPath },
      { new: true }
    ).lean();

    const { passwordHash: _, ...publicUser } = updated;
    return res.json({ success: true, user: publicUser, profilePic: publicPath });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, updateProfile, uploadAvatar };
