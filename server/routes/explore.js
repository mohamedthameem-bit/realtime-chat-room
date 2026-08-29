const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/exploreController');
const { requireAuth } = require('../middleware/auth');

// GET /api/explore
router.get('/', requireAuth, ctrl.getExplore);

module.exports = router;
