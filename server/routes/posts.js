const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ctrl = require('../controllers/postController');
// Assuming the authentication middleware is located here.
const { requireAuth } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../public/uploads/posts')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

router.post('/', requireAuth, upload.array('media', 10), ctrl.createPost);
router.get('/feed', requireAuth, ctrl.getFeed);
router.get('/archived', requireAuth, ctrl.getArchived);
router.get('/user/:userId', requireAuth, ctrl.getUserPosts);
router.get('/:id', requireAuth, ctrl.getPost);
router.patch('/:id', requireAuth, ctrl.editPost);
router.delete('/:id', requireAuth, ctrl.deletePost);
router.post('/:id/like', requireAuth, ctrl.toggleLike);
router.post('/:id/save', requireAuth, ctrl.toggleSave);
router.post('/:id/share', requireAuth, ctrl.incrementShare);
router.patch('/:id/archive', requireAuth, ctrl.toggleArchive);

module.exports = router;
