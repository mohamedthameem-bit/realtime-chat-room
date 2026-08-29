const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const {
  createStory,
  getFeedStories,
  reactToStory,
  deleteStory
} = require('../controllers/storyController');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

router.use(requireAuth);

router.post('/', upload.single('media'), createStory);
router.get('/feed', getFeedStories);
router.post('/:id/react', reactToStory);
router.delete('/:id', deleteStory);

module.exports = router;
