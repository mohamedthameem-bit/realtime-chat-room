const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  createNote,
  getNotes,
  deleteNote
} = require('../controllers/noteController');

router.use(requireAuth);

router.post('/', createNote);
router.get('/', getNotes);
router.delete('/:id', deleteNote);

module.exports = router;
