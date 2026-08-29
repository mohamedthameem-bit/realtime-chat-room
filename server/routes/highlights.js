const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  createHighlight,
  getUserHighlights,
  addStory,
  deleteHighlight
} = require('../controllers/highlightController');

router.use(requireAuth);

router.post('/', createHighlight);
router.get('/user/:userId', getUserHighlights);
router.post('/:id/add', addStory);
router.delete('/:id', deleteHighlight);

module.exports = router;
