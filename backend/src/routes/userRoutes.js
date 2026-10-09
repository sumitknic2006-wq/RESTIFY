const express = require('express');
const requireAuth = require('../middleware/authMiddleware');
const userController = require('../controllers/userController');
const validateRequest = require('../middleware/validationMiddleware');
const { validatePreferences } = require('../validators/userPreferencesValidator');

const router = express.Router();
router.use(requireAuth);
router.get('/me', userController.getCurrentUser);
router.patch('/me/preferences', validateRequest(validatePreferences), userController.updatePreferences);

module.exports = router;
