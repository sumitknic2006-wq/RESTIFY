const express = require('express');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const requireAuth = require('../middleware/authMiddleware');
const authRateLimit = require('../middleware/rateLimitMiddleware');
const validateRequest = require('../middleware/validationMiddleware');
const { validateLogin, validateRegister } = require('../validators/authValidator');

const router = express.Router();

router.post('/register', authRateLimit, validateRequest(validateRegister), authController.register);
router.post('/login', authRateLimit, validateRequest(validateLogin), authController.login);
router.post('/logout', requireAuth, authController.logout);
router.get('/me', requireAuth, userController.getCurrentUser);

module.exports = router;
