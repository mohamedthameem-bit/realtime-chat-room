/**
 * notificationController.js — CRUD operations for user notifications,
 * plus a helper to create notifications from other controllers.
 */

const Notification = require('../models/Notification');

// ── Route handlers ────────────────────────────────────────────────────────────

/**
 * GET /api/notifications?page=1
 * Returns paginated notifications for the authenticated user.
 */
async function getNotifications(req, res) {
  try {
    const page  = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = 20;
    const skip  = (page - 1) * limit;

    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1) // fetch one extra to determine hasMore
      .populate('sender', 'username name profilePic isVerified')
      .lean();

    const hasMore = notifications.length > limit;
    if (hasMore) notifications.pop();

    return res.json({ notifications, page, hasMore });
  } catch (err) {
    console.error('getNotifications error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * PATCH /api/notifications/read-all
 * Marks every unread notification for the user as read.
 */
async function markAllRead(req, res) {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('markAllRead error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read (ownership check included).
 */
async function markOneRead(req, res) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    return res.json({ success: true, notification });
  } catch (err) {
    console.error('markOneRead error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * DELETE /api/notifications/clear
 * Deletes all notifications for the authenticated user.
 */
async function clearAll(req, res) {
  try {
    await Notification.deleteMany({ recipient: req.user._id });

    return res.json({ success: true });
  } catch (err) {
    console.error('clearAll error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * GET /api/notifications/unread-count
 * Returns the number of unread notifications for the user.
 */
async function getUnreadCount(req, res) {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false
    });

    return res.json({ count });
  } catch (err) {
    console.error('getUnreadCount error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ── Internal helper ───────────────────────────────────────────────────────────

/**
 * Create a notification document (called by other controllers, not a route).
 *
 * Deduplicates: skips creation if an identical notification
 * (same recipient + sender + type + targetId) already exists
 * within the last 5 minutes.
 *
 * @param {object} opts
 * @param {string} opts.recipient   - Recipient user ID
 * @param {string} opts.sender      - Sender user ID
 * @param {string} opts.type        - Notification type enum value
 * @param {string} [opts.targetType]
 * @param {string} [opts.targetId]
 * @param {string} [opts.text]
 * @param {string} [opts.thumbnailUrl]
 * @param {object} [opts.io]        - Socket.IO server instance
 * @returns {Promise<object|null>}  The created notification, or null if deduplicated
 */
async function createNotification({ recipient, sender, type, targetType, targetId, text, thumbnailUrl, io }) {
  try {
    // ── Deduplicate ──────────────────────────────────────────────────────
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const duplicate = await Notification.findOne({
      recipient,
      sender,
      type,
      targetId: targetId || null,
      createdAt: { $gte: fiveMinutesAgo }
    }).lean();

    if (duplicate) return null;

    // ── Create ───────────────────────────────────────────────────────────
    const notification = await Notification.create({
      recipient,
      sender,
      type,
      targetType: targetType || null,
      targetId:   targetId || null,
      text:         text || '',
      thumbnailUrl: thumbnailUrl || ''
    });

    // ── Real-time push ───────────────────────────────────────────────────
    if (io) {
      const populated = await Notification.findById(notification._id)
        .populate('sender', 'username name profilePic isVerified')
        .lean();

      io.to(recipient.toString()).emit('new-notification', populated);
    }

    return notification;
  } catch (err) {
    console.error('createNotification error:', err);
    return null;
  }
}

module.exports = {
  getNotifications,
  markAllRead,
  markOneRead,
  clearAll,
  getUnreadCount,
  createNotification
};
