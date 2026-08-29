const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ctrl = require('../controllers/reelController');
const { requireAuth } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Note: Assuming the directory exists or is created elsewhere.
    cb(null, path.join(__dirname, '../../public/uploads/reels'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

router.post('/', requireAuth, upload.single('video'), ctrl.createReel);
router.get('/feed', requireAuth, ctrl.getFeedReels);
router.post('/:id/like', requireAuth, ctrl.likeReel);
router.delete('/:id', requireAuth, ctrl.deleteReel);

module.exports = router;
