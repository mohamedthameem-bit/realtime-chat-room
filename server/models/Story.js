const mongoose = require('mongoose');

const stickerSchema = new mongoose.Schema({
  type: { type: String, enum: ['poll', 'question', 'slider', 'mention', 'hashtag', 'link', 'music', 'countdown'] },
  data: mongoose.Schema.Types.Mixed,
  position: { x: Number, y: Number }
}, { _id: false });

const viewerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  viewedAt: { type: Date, default: Date.now },
  reaction: { type: String, default: '' }
}, { _id: false });

const storySchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mediaUrl: { type: String, required: true },
  mediaType: { type: String, enum: ['image', 'video'], required: true },
  duration: { type: Number, default: 5 },
  caption: { type: String, maxlength: 200, default: '' },
  stickers: [stickerSchema],
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  viewers: [viewerSchema],
  audience: { type: String, enum: ['public', 'followers', 'close-friends'], default: 'followers' },
  expiresAt: Date,
  isHighlighted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: false, versionKey: false });

storySchema.index({ author: 1, expiresAt: 1 });
storySchema.index({ 'viewers.user': 1 });
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

module.exports = mongoose.model('Story', storySchema);
