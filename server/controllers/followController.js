/**
 * followController.js — Instagram-style follow system (Phase 8).
 */

const User = require('../models/User');
const Notification = require('../models/Notification');

/**
 * POST /api/follow/:userId
 * Follow a user. If the target account is private, sends a follow request instead.
 */
async function followUser(req, res, next) {
  try {
    const userId = req.user._id;
    const targetUserId = req.params.userId;

    if (userId.toString() === targetUserId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot follow yourself.' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

    // Prevent duplicate follow
    if (targetUser.followers.some(id => id.toString() === userId.toString())) {
      return res.status(400).json({ success: false, message: 'Already following this user.' });
    }

    // Prevent duplicate follow request
    if (targetUser.followRequests.some(id => id.toString() === userId.toString())) {
      return res.status(400).json({ success: false, message: 'Follow request already sent.' });
    }

    const io = req.app.get('io');

    if (targetUser.isPrivate) {
      // Private account — send follow request
      await User.findByIdAndUpdate(targetUserId, {
        $addToSet: { followRequests: userId },
      });

      await Notification.create({
        recipient: targetUserId,
        sender: userId,
        type: 'follow_request',
        targetType: 'user',
        targetId: userId,
        text: `${req.user.username} requested to follow you.`,
      });

      if (io) {
        io.to(targetUserId.toString()).emit('follow-request', {
          from: {
            _id: userId,
            username: req.user.username,
            profilePic: req.user.profilePic,
          },
        });
      }

      return res.status(201).json({ success: true, message: 'Follow request sent.' });
    }

    // Public account — follow immediately
    await User.findByIdAndUpdate(targetUserId, {
      $addToSet: { followers: userId },
      $inc: { followerCount: 1 },
    });
    await User.findByIdAndUpdate(userId, {
      $addToSet: { following: targetUserId },
      $inc: { followingCount: 1 },
    });

    await Notification.create({
      recipient: targetUserId,
      sender: userId,
      type: 'follow',
      targetType: 'user',
      targetId: userId,
      text: `${req.user.username} started following you.`,
    });

    if (io) {
      io.to(targetUserId.toString()).emit('follow-accepted', {
        from: {
          _id: userId,
          username: req.user.username,
          profilePic: req.user.profilePic,
        },
      });
    }

    res.status(201).json({ success: true, message: 'Followed successfully.' });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/follow/:userId
 * Unfollow a user.
 */
async function unfollowUser(req, res, next) {
  try {
    const userId = req.user._id;
    const targetUserId = req.params.userId;

    await User.findByIdAndUpdate(targetUserId, {
      $pull: { followers: userId },
      $inc: { followerCount: -1 },
    });
    await User.findByIdAndUpdate(userId, {
      $pull: { following: targetUserId },
      $inc: { followingCount: -1 },
    });

    res.json({ success: true, message: 'Unfollowed successfully.' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/follow/accept/:userId
 * Accept a pending follow request.
 */
async function acceptFollowRequest(req, res, next) {
  try {
    const userId = req.user._id;
    const requesterId = req.params.userId;

    const user = await User.findById(userId);
    if (!user.followRequests.some(id => id.toString() === requesterId.toString())) {
      return res.status(404).json({ success: false, message: 'Follow request not found.' });
    }

    // Move from followRequests to followers/following
    await User.findByIdAndUpdate(userId, {
      $pull: { followRequests: requesterId },
      $addToSet: { followers: requesterId },
      $inc: { followerCount: 1 },
    });
    await User.findByIdAndUpdate(requesterId, {
      $addToSet: { following: userId },
      $inc: { followingCount: 1 },
    });

    await Notification.create({
      recipient: requesterId,
      sender: userId,
      type: 'follow_accepted',
      targetType: 'user',
      targetId: userId,
      text: `${req.user.username} accepted your follow request.`,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(requesterId.toString()).emit('follow-accepted', {
        from: {
          _id: userId,
          username: req.user.username,
          profilePic: req.user.profilePic,
        },
      });
    }

    res.json({ success: true, message: 'Follow request accepted.' });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/follow/decline/:userId
 * Decline a pending follow request silently.
 */
async function declineFollowRequest(req, res, next) {
  try {
    const userId = req.user._id;
    const requesterId = req.params.userId;

    await User.findByIdAndUpdate(userId, {
      $pull: { followRequests: requesterId },
    });

    res.json({ success: true, message: 'Follow request declined.' });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/follow/remove/:userId
 * Remove a follower from your own followers list.
 */
async function removeFollower(req, res, next) {
  try {
    const userId = req.user._id;
    const targetUserId = req.params.userId;

    await User.findByIdAndUpdate(userId, {
      $pull: { followers: targetUserId },
      $inc: { followerCount: -1 },
    });
    await User.findByIdAndUpdate(targetUserId, {
      $pull: { following: userId },
      $inc: { followingCount: -1 },
    });

    res.json({ success: true, message: 'Follower removed.' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/follow/followers/:userId
 * Return the followers list for a user.
 * Private accounts restrict access to non-followers.
 */
async function getFollowers(req, res, next) {
  try {
    const requesterId = req.user._id;
    const targetUserId = req.params.userId;

    const targetUser = await User.findById(targetUserId).lean();
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

    // Private account check
    if (
      targetUser.isPrivate &&
      requesterId.toString() !== targetUserId.toString() &&
      !targetUser.followers.some(id => id.toString() === requesterId.toString())
    ) {
      return res.status(403).json({ success: false, message: 'This account is private.' });
    }

    const user = await User.findById(targetUserId)
      .populate('followers', 'username name profilePic isVerified followerCount')
      .lean();

    res.json({ success: true, followers: user.followers || [] });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/follow/following/:userId
 * Return the following list for a user.
 * Private accounts restrict access to non-followers.
 */
async function getFollowing(req, res, next) {
  try {
    const requesterId = req.user._id;
    const targetUserId = req.params.userId;

    const targetUser = await User.findById(targetUserId).lean();
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

    // Private account check
    if (
      targetUser.isPrivate &&
      requesterId.toString() !== targetUserId.toString() &&
      !targetUser.followers.some(id => id.toString() === requesterId.toString())
    ) {
      return res.status(403).json({ success: false, message: 'This account is private.' });
    }

    const user = await User.findById(targetUserId)
      .populate('following', 'username name profilePic isVerified followerCount')
      .lean();

    res.json({ success: true, following: user.following || [] });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/follow/close-friends
 * Replace the authenticated user's close friends list.
 * Body: { ids: [userId, …] }
 */
async function updateCloseFriends(req, res, next) {
  try {
    const userId = req.user._id;
    const { ids } = req.body;

    if (!Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: 'ids must be an array.' });
    }

    await User.findByIdAndUpdate(userId, { closeFriends: ids });

    res.json({ success: true, message: 'Close friends updated.' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/follow/close-friends
 * Return the authenticated user's close friends list.
 */
async function getCloseFriends(req, res, next) {
  try {
    const user = await User.findById(req.user._id)
      .populate('closeFriends', 'username name profilePic isVerified followerCount')
      .lean();

    res.json({ success: true, closeFriends: user.closeFriends || [] });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/follow/mute/:userId
 * Mute or unmute a user's posts and/or stories.
 * Body: { mutePosts: Boolean, muteStories: Boolean }
 */
async function muteUser(req, res, next) {
  try {
    const userId = req.user._id;
    const targetUserId = req.params.userId;
    const { mutePosts, muteStories } = req.body;

    // Remove any existing entry for this target
    await User.findByIdAndUpdate(userId, {
      $pull: { muteList: { userId: targetUserId } },
    });

    // Only add back if at least one mute flag is true
    if (mutePosts || muteStories) {
      await User.findByIdAndUpdate(userId, {
        $push: {
          muteList: {
            userId: targetUserId,
            mutePosts: !!mutePosts,
            muteStories: !!muteStories,
          },
        },
      });
    }

    res.json({ success: true, message: 'Mute settings updated.' });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/follow/restrict/:userId
 * Toggle a user in the authenticated user's restricted list.
 */
async function restrictUser(req, res, next) {
  try {
    const userId = req.user._id;
    const targetUserId = req.params.userId;

    const user = await User.findById(userId);
    const isRestricted = user.restrictedList.some(id => id.toString() === targetUserId.toString());

    if (isRestricted) {
      await User.findByIdAndUpdate(userId, {
        $pull: { restrictedList: targetUserId },
      });
      return res.json({ success: true, message: 'User unrestricted.', restricted: false });
    }

    await User.findByIdAndUpdate(userId, {
      $addToSet: { restrictedList: targetUserId },
    });
    res.json({ success: true, message: 'User restricted.', restricted: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  followUser,
  unfollowUser,
  acceptFollowRequest,
  declineFollowRequest,
  removeFollower,
  getFollowers,
  getFollowing,
  updateCloseFriends,
  getCloseFriends,
  muteUser,
  restrictUser,
};
