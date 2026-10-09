const express = require('express');
const requireAuth = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validationMiddleware');
const goalController = require('../controllers/goalController');
const {
  validateGoalCreate,
  validateGoalId,
  validateGoalUpdate,
} = require('../validators/goalValidator');

const router = express.Router();

router.use(requireAuth);
router.param('id', validateGoalId);
router.post('/', validateRequest(validateGoalCreate), goalController.createGoal);
router.get('/', goalController.getGoals);
router.get('/:id/progress', goalController.getGoalProgress);
router.get('/:id', goalController.getGoal);
router.put('/:id', validateRequest(validateGoalUpdate), goalController.updateGoal);
router.delete('/:id', goalController.deleteGoal);

module.exports = router;
