const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/followController');

// Close friends (must be before /:userId routes)
router.get('/close-friends', requireAuth, ctrl.getCloseFriends);
router.patch('/close-friends', requireAuth, ctrl.updateCloseFriends);

// Accept/decline follow requests
router.post('/accept/:userId', requireAuth, ctrl.acceptFollowRequest);
router.delete('/decline/:userId', requireAuth, ctrl.declineFollowRequest);

// Remove follower
router.delete('/remove/:userId', requireAuth, ctrl.removeFollower);

// Mute/Restrict
router.patch('/mute/:userId', requireAuth, ctrl.muteUser);
router.patch('/restrict/:userId', requireAuth, ctrl.restrictUser);

// Follow/Unfollow
router.post('/:userId', requireAuth, ctrl.followUser);
router.delete('/:userId', requireAuth, ctrl.unfollowUser);

// Followers/Following lists
router.get('/followers/:userId', requireAuth, ctrl.getFollowers);
router.get('/following/:userId', requireAuth, ctrl.getFollowing);

module.exports = router;
