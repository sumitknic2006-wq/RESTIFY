const mongoose = require('mongoose');
const Goal = require('../models/Goal');
const analyticsService = require('./analyticsService');
const createAppError = require('../utils/appError');
const { validateGoalCreate, validateGoalUpdate } = require('../validators/goalValidator');
const notificationService = require('./notificationService');

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getGoalPeriod(period, now) {
  const today = utcDay(now);
  if (period === 'daily') return { start: today, end: new Date(today.getTime() + DAY_MS) };
  const start = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY_MS);
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
}

function nextGoalPeriodStart(period, now) {
  const today = utcDay(now);
  if (period === 'daily') return new Date(today.getTime() + DAY_MS);
  const weekStart = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY_MS);
  return new Date(weekStart.getTime() + 7 * DAY_MS);
}

function assertValidGoalId(id) {
  if (!mongoose.isObjectIdOrHexString(id)) {
    throw createAppError(400, 'Goal ID is invalid.', 'INVALID_GOAL_ID');
  }
}

function assertValid(validator, input) {
  const errors = validator(input);
  if (errors.length) {
    throw createAppError(400, 'Please provide valid goal information.', 'VALIDATION_ERROR', errors);
  }
}

function serializeGoal(goal) {
  return {
    id: goal._id.toString(),
    period: goal.period,
    targetMinutes: goal.targetMinutes,
    isActive: goal.isActive,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

async function addProgress(goal, now = new Date()) {
  const period = getGoalPeriod(goal.period, now);
  const result = await analyticsService.getAnalyticsForRange(
    goal.user,
    period.start,
    period.end,
    now
  );
  const totalDurationSeconds = result.totalDurationSeconds;
  const targetDurationSeconds = goal.targetMinutes * 60;
  const hasTrackedData = result.activities.length > 0;
  if (hasTrackedData && totalDurationSeconds >= targetDurationSeconds) {
    await notificationService.createForUser(goal.user, {
      category: 'goals',
      sourceKey: `goal:${goal._id}:${period.start.toISOString().slice(0, 10)}:limit-reached`,
      title: `${goal.period === 'daily' ? 'Daily' : 'Weekly'} screen-time goal reached`,
      message: `Recorded screen time has reached the ${goal.targetMinutes}-minute ${goal.period} limit.`,
    });
  }
  const isComplete =
    period.end <= now && hasTrackedData && totalDurationSeconds <= targetDurationSeconds;

  return {
    ...serializeGoal(goal),
    progress: {
      start: period.start.toISOString(),
      end: period.end.toISOString(),
      timezone: 'UTC',
      totalDurationSeconds,
      targetDurationSeconds,
      remainingSeconds: Math.max(0, targetDurationSeconds - totalDurationSeconds),
      exceededSeconds: Math.max(0, totalDurationSeconds - targetDurationSeconds),
      percentUsed:
        targetDurationSeconds === 0
          ? 0
          : Math.round((totalDurationSeconds / targetDurationSeconds) * 100),
      hasTrackedData,
      isComplete,
      onTrack:
        period.end > now &&
        totalDurationSeconds <= targetDurationSeconds &&
        hasTrackedData,
    },
  };
}

async function createGoal(userId, input) {
  assertValid(validateGoalCreate, input);
  const now = new Date();
  const goal = await Goal.create({
    user: userId,
    period: input.period,
    targetMinutes: input.targetMinutes,
    isActive: true,
    targetHistory: [
      {
        period: input.period,
        targetMinutes: input.targetMinutes,
        effectiveFrom: nextGoalPeriodStart(input.period, now),
      },
    ],
  });
  return addProgress(goal, now);
}

async function getGoals(userId) {
  const goals = await Goal.find({ user: userId }).sort({ createdAt: -1 });
  const now = new Date();
  const results = await Promise.all(goals.map((goal) => addProgress(goal, now)));
  return results;
}

async function findOwnedGoal(userId, goalId) {
  assertValidGoalId(goalId);
  const goal = await Goal.findOne({ _id: goalId, user: userId });
  if (!goal) throw createAppError(404, 'Goal not found.', 'GOAL_NOT_FOUND');
  return goal;
}

async function getGoalById(userId, goalId) {
  const goal = await findOwnedGoal(userId, goalId);
  return addProgress(goal);
}

async function updateGoal(userId, goalId, input) {
  assertValid(validateGoalUpdate, input);
  const goal = await findOwnedGoal(userId, goalId);
  assertValid(validateGoalCreate, {
    period: input.period || goal.period,
    targetMinutes: input.targetMinutes ?? goal.targetMinutes,
  });
  const periodChanged = Object.hasOwn(input, 'period') && input.period !== goal.period;
  const targetChanged =
    Object.hasOwn(input, 'targetMinutes') && input.targetMinutes !== goal.targetMinutes;
  if (periodChanged || targetChanged) {
    const nextPeriod = input.period || goal.period;
    const nextTarget = input.targetMinutes ?? goal.targetMinutes;
    goal.targetHistory.push({
      period: nextPeriod,
      targetMinutes: nextTarget,
      effectiveFrom: nextGoalPeriodStart(nextPeriod, new Date()),
    });
  }
  if (Object.hasOwn(input, 'period')) goal.period = input.period;
  if (Object.hasOwn(input, 'targetMinutes')) goal.targetMinutes = input.targetMinutes;
  if (Object.hasOwn(input, 'isActive')) goal.isActive = input.isActive;
  await goal.save();
  return addProgress(goal);
}

async function deleteGoal(userId, goalId) {
  assertValidGoalId(goalId);
  const deleted = await Goal.findOneAndDelete({ _id: goalId, user: userId });
  if (!deleted) throw createAppError(404, 'Goal not found.', 'GOAL_NOT_FOUND');
  return { id: deleted._id.toString() };
}

async function getGoalProgress(userId, goalId) {
  const result = await getGoalById(userId, goalId);
  return { goalId: result.id, ...result.progress };
}

module.exports = {
  addProgress,
  createGoal,
  deleteGoal,
  getGoalById,
  getGoalProgress,
  getGoals,
  getGoalPeriod,
  nextGoalPeriodStart,
  updateGoal,
};
