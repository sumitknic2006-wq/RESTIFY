const express = require('express');
const requireAuth = require('../middleware/authMiddleware');
const requireAdmin = require('../middleware/adminMiddleware');
const adminController = require('../controllers/adminController');

const router = express.Router();
router.use(requireAuth, requireAdmin);
router.get('/overview', adminController.getOverview);
router.get('/users', adminController.getUsers);

module.exports = router;
