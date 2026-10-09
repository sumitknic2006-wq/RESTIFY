const express = require('express');
const requireAuth = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validationMiddleware');
const activityController = require('../controllers/activityController');
const { validateActivityStart } = require('../validators/activityValidator');

const router = express.Router();

router.use(requireAuth);
router.post('/start', validateRequest(validateActivityStart), activityController.startActivity);
router.post('/stop', activityController.stopActivity);
router.get('/today', activityController.getTodayActivities);
router.get('/', activityController.getUserActivities);

module.exports = router;
