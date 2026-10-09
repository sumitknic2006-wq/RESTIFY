const express = require('express');
const requireAuth = require('../middleware/authMiddleware');
const analyticsController = require('../controllers/analyticsController');

const router = express.Router();

router.use(requireAuth);
router.get('/today', analyticsController.getTodayAnalytics);
router.get('/weekly', analyticsController.getWeeklyAnalytics);
router.get('/monthly', analyticsController.getMonthlyAnalytics);
router.get('/ranking', analyticsController.getActivityRanking);
router.get('/heatmap', analyticsController.getHeatmap);

module.exports = router;
