/**
 * profile.js — User profile routes (all protected by requireAuth).
 */

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();

const { getProfile, updateProfile, uploadAvatar, updateStatus } = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');

// ── Multer configuration ──────────────────────────────────────────────────────

// Ensure the uploads directory exists
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'avatars');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // userId_timestamp.ext  — avoids filename collisions
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user._id}_${Date.now()}${ext}`);
  },
});

const avatarUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WebP images are allowed.'));
    }
  },
});

// ── Routes ────────────────────────────────────────────────────────────────────

router.use(requireAuth);

// GET  /api/profile         — return current user's profile
router.get('/',           getProfile);

// PUT  /api/profile         — update username / name / bio
router.put('/',           updateProfile);

// POST /api/profile/avatar  — upload a new avatar image
router.post('/avatar', avatarUpload.single('avatar'), uploadAvatar);

// PATCH /api/profile/status — update user status
router.patch('/status', updateStatus);

// Handle multer errors (file type / size violations)
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File is too large. Maximum size is 2 MB.' });
  }
  if (err.message) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

module.exports = router;
