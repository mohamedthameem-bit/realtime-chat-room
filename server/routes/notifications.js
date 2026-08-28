const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

router.get('/', requireAuth, ctrl.getNotifications);
router.get('/unread-count', requireAuth, ctrl.getUnreadCount);
router.patch('/read-all', requireAuth, ctrl.markAllRead);
router.patch('/:id/read', requireAuth, ctrl.markOneRead);
router.delete('/clear', requireAuth, ctrl.clearAll);

module.exports = router;
