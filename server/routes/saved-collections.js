const express = require('express');
const router = express.Router();
const savedCollectionController = require('../controllers/savedCollectionController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', savedCollectionController.getCollections);
router.post('/', savedCollectionController.createCollection);
router.get('/:id', savedCollectionController.getCollectionById);

module.exports = router;
