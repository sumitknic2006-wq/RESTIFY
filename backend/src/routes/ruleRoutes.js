const express = require('express');
const requireAuth = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validationMiddleware');
const ruleController = require('../controllers/ruleController');
const {
  validateRuleCreate,
  validateRuleId,
  validateRuleUpdate,
} = require('../validators/ruleValidator');

const router = express.Router();

router.use(requireAuth);
router.param('id', validateRuleId);

router.post('/', validateRequest(validateRuleCreate), ruleController.createRule);
router.get('/', ruleController.getUserRules);
router.get('/:id', ruleController.getRuleById);
router.put('/:id', validateRequest(validateRuleUpdate), ruleController.updateRule);
router.delete('/:id', ruleController.deleteRule);
router.patch('/:id/toggle', ruleController.toggleRule);

module.exports = router;
