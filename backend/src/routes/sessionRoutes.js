const express = require('express');
const requireAuth = require('../middleware/authMiddleware');
const sessionController = require('../controllers/sessionController');
const validateRequest = require('../middleware/validationMiddleware');
const {
  validatePauseSession,
  validateSessionId,
  validateStartSession,
} = require('../validators/sessionValidator');

const router = express.Router();

router.use(requireAuth);
router.param('id', validateSessionId);
router.post('/start', validateRequest(validateStartSession), sessionController.startSession);
router.get('/active', sessionController.getActiveSession);
router.get('/', sessionController.getSessions);
router.patch('/:id/pause', validateRequest(validatePauseSession), sessionController.pauseSession);
router.patch('/:id/resume', sessionController.resumeSession);
router.patch('/:id/end', sessionController.endSession);

module.exports = router;
