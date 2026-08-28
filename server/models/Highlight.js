const mongoose = require('mongoose');

const highlightSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 15, trim: true },
  coverUrl: { type: String, default: '' },
  stories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Story' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: false, versionKey: false });

highlightSchema.index({ owner: 1 });

module.exports = mongoose.model('Highlight', highlightSchema);
