const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: {
    type: String,
    enum: [
      'like_post', 'like_reel', 'like_comment',
      'comment', 'reply_comment',
      'mention_post', 'mention_reel', 'mention_comment', 'mention_story',
      'follow', 'follow_request', 'follow_accepted',
      'friend_request', 'friend_accepted',
      'story_reaction', 'dm', 'story_reply',
      'reel_view_milestone'
    ],
    required: true
  },
  targetType: { type: String, enum: ['post', 'reel', 'story', 'comment', 'user', null], default: null },
  targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
  text: { type: String, default: '' },
  thumbnailUrl: { type: String, default: '' },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: false, versionKey: false });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

notificationSchema.post('save', function (doc) {
  try {
    const { emitNotification } = require('../socket');
    emitNotification(doc.recipient, doc);
  } catch (err) {
    console.error('Error emitting notification:', err);
  }
});

module.exports = mongoose.model('Notification', notificationSchema);
