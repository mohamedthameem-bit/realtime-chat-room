/**
 * friendController.js — Friend requests and list management (Phase 6).
 */

const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');

/**
 * POST /api/friends/request
 * Send a friend request.
 * Body: { targetUserId }
 */
async function sendRequest(req, res, next) {
  try {
    const userId = req.user._id;
    const { targetUserId } = req.body;

    if (!targetUserId) return res.status(400).json({ success: false, message: 'Target user ID required.' });
    if (userId.toString() === targetUserId.toString()) return res.status(400).json({ success: false, message: 'Cannot friend yourself.' });

    const targetUser = await User.findById(targetUserId).lean();
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

    // Check if already friends
    const me = await User.findById(userId).lean();
    if (me.friends && me.friends.some(id => id.toString() === targetUserId.toString())) {
      return res.status(400).json({ success: false, message: 'Already friends.' });
    }

    // Check if a request already exists in either direction
    const existingReq = await FriendRequest.findOne({
      $or: [
        { from: userId, to: targetUserId },
        { from: targetUserId, to: userId }
      ],
      status: 'pending'
    });

    if (existingReq) {
      if (existingReq.from.toString() === userId.toString()) {
        return res.status(400).json({ success: false, message: 'Request already sent.' });
      } else {
        return res.status(400).json({ success: false, message: 'They already sent you a request. Please accept it.' });
      }
    }

    const newReq = await FriendRequest.create({ from: userId, to: targetUserId });

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      // Find socket for targetUser
      // This requires global tracking which we will add in handlers.js
      io.to(`user:${targetUserId}`).emit('friend-request-received', {
        from: {
          username: req.user.username,
          profilePic: req.user.profilePic,
        }
      });
    }

    res.json({ success: true, message: 'Request sent.' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/friends/accept
 * Accept a friend request.
 * Body: { requestId }
 */
async function acceptRequest(req, res, next) {
  try {
    const userId = req.user._id;
    const { requestId } = req.body;

    const request = await FriendRequest.findOne({ _id: requestId, to: userId, status: 'pending' });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found or already processed.' });

    request.status = 'accepted';
    await request.save();

    // Add to each other's friends array
    await User.findByIdAndUpdate(userId, { $addToSet: { friends: request.from } });
    await User.findByIdAndUpdate(request.from, { $addToSet: { friends: userId } });

    res.json({ success: true, message: 'Request accepted.' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/friends/decline
 * Decline a friend request.
 * Body: { requestId }
 */
async function declineRequest(req, res, next) {
  try {
    const userId = req.user._id;
    const { requestId } = req.body;

    const request = await FriendRequest.findOne({ _id: requestId, to: userId, status: 'pending' });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });

    request.status = 'declined';
    await request.save();

    res.json({ success: true, message: 'Request declined.' });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/friends/:userId
 * Remove a friend.
 */
async function removeFriend(req, res, next) {
  try {
    const userId = req.user._id;
    const targetUserId = req.params.userId;

    await User.findByIdAndUpdate(userId, { $pull: { friends: targetUserId } });
    await User.findByIdAndUpdate(targetUserId, { $pull: { friends: userId } });

    res.json({ success: true, message: 'Friend removed.' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/friends
 * List all accepted friends.
 */
async function getFriends(req, res, next) {
  try {
    const user = await User.findById(req.user._id).populate('friends', 'username profilePic status bio').lean();
    res.json({ success: true, friends: user.friends || [] });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/friends/requests
 * List pending incoming requests.
 */
async function getRequests(req, res, next) {
  try {
    const requests = await FriendRequest.find({ to: req.user._id, status: 'pending' })
      .populate('from', 'username profilePic status')
      .lean();
    res.json({ success: true, requests });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  sendRequest,
  acceptRequest,
  declineRequest,
  removeFriend,
  getFriends,
  getRequests,
};
