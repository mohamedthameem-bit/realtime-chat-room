const mongoose = require('mongoose');

const savedItemSchema = new mongoose.Schema({
  targetType: { type: String, enum: ['post', 'reel'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  savedAt: { type: Date, default: Date.now }
}, { _id: true });

const savedCollectionSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, maxlength: 50, trim: true },
  coverUrl: { type: String, default: '' },
  items: [savedItemSchema],
  createdAt: { type: Date, default: Date.now }
}, { timestamps: false, versionKey: false });

savedCollectionSchema.index({ owner: 1 });

module.exports = mongoose.model('SavedCollection', savedCollectionSchema);
