const express = require('express');
const requireAuth = require('../middleware/authMiddleware');
const streakController = require('../controllers/streakController');

const router = express.Router();
router.use(requireAuth);
router.get('/', streakController.getStreak);

module.exports = router;
