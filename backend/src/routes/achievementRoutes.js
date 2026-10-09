const express = require('express');
const requireAuth = require('../middleware/authMiddleware');
const achievementController = require('../controllers/achievementController');

const router = express.Router();
router.use(requireAuth);
router.get('/', achievementController.getAchievements);

module.exports = router;
