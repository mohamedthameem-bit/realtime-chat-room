/**
 * userController.js — User search and profile fetch (Phase 6).
 */

const User = require('../models/User');

/**
 * GET /api/users/search?q=query
 * Search users by username (case-insensitive, partial match).
 */
async function searchUsers(req, res, next) {
  try {
    const userId = req.user._id;
    const query = req.query.q || '';

    if (!query) {
      return res.json({ success: true, users: [] });
    }

    const regex = new RegExp(query, 'i');

    const users = await User.find({
      username: regex,
      _id: { $ne: userId }, // Exclude self
    })
      .select('_id username profilePic status bio')
      .limit(20)
      .lean();

    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/:id
 * Get a single user's public profile.
 */
async function getUserProfile(req, res, next) {
  try {
    const targetUserId = req.params.id;

    const user = await User.findById(targetUserId)
      .select('_id username profilePic bio status createdAt friends')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const publicProfile = {
      _id: user._id,
      username: user.username,
      profilePic: user.profilePic,
      bio: user.bio,
      status: user.status,
      createdAt: user.createdAt,
      friendCount: user.friends ? user.friends.length : 0,
    };

    res.json({ success: true, user: publicProfile });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  searchUsers,
  getUserProfile,
};
