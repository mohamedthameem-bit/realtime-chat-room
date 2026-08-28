const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 60, trim: true },
  audience: { type: String, enum: ['followers', 'close-friends'], default: 'followers' },
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now }
}, { timestamps: false, versionKey: false });

noteSchema.index({ author: 1 });
noteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

module.exports = mongoose.model('Note', noteSchema);
