const express = require('express');
const requireAuth = require('../middleware/authMiddleware');
const challengeController = require('../controllers/challengeController');

const router = express.Router();
router.use(requireAuth);
router.get('/today', challengeController.getTodayChallenge);
router.post('/today/complete', challengeController.completeTodayChallenge);

module.exports = router;
