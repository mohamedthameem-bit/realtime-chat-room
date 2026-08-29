const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/commentController');

router.post('/', requireAuth, ctrl.createComment);
router.get('/', requireAuth, ctrl.getComments);
router.patch('/:id', requireAuth, ctrl.editComment);
router.delete('/:id', requireAuth, ctrl.deleteComment);
router.post('/:id/like', requireAuth, ctrl.toggleLike);

module.exports = router;
