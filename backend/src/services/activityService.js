const Activity = require('../models/Activity');
const createAppError = require('../utils/appError');
const { validateActivityStart } = require('../validators/activityValidator');

function assertValidInput(input) {
  const errors = validateActivityStart(input);
  if (errors.length) {
    throw createAppError(400, 'Please provide valid activity information.', 'VALIDATION_ERROR', errors);
  }
}

function serializeActivity(activity) {
  return {
    id: activity._id.toString(),
    activity: activity.activity,
    target: activity.target || null,
    startTime: activity.startTime,
    endTime: activity.endTime,
    durationSeconds: activity.durationSeconds,
    date: activity.date,
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
  };
}

async function startActivity(userId, input) {
  assertValidInput(input);
  const activeActivity = await Activity.findOne({ user: userId, endTime: null }).select('_id');
  if (activeActivity) {
    throw createAppError(409, 'Stop the active activity before starting another.', 'ACTIVITY_ALREADY_ACTIVE');
  }

  const startTime = new Date();
  const date = new Date(Date.UTC(startTime.getUTCFullYear(), startTime.getUTCMonth(), startTime.getUTCDate()));
  try {
    const activity = await Activity.create({
      user: userId,
      activity: input.activity.trim(),
      ...(input.target === undefined ? {} : { target: input.target.trim() }),
      startTime,
      date,
    });
    return serializeActivity(activity);
  } catch (error) {
    if (error.code === 11000) {
      throw createAppError(409, 'Stop the active activity before starting another.', 'ACTIVITY_ALREADY_ACTIVE');
    }
    throw error;
  }
}

async function stopActivity(userId) {
  const activity = await Activity.findOne({ user: userId, endTime: null }).sort({ startTime: -1 });
  if (!activity) {
    throw createAppError(404, 'No active activity was found.', 'ACTIVE_ACTIVITY_NOT_FOUND');
  }

  const endTime = new Date();
  const durationSeconds = Math.max(
    0,
    Math.floor((endTime.getTime() - activity.startTime.getTime()) / 1000)
  );
  const stoppedActivity = await Activity.findOneAndUpdate(
    { _id: activity._id, user: userId, endTime: null },
    { $set: { endTime, durationSeconds } },
    { new: true, runValidators: true }
  );
  if (!stoppedActivity) {
    throw createAppError(409, 'The activity has already been stopped.', 'ACTIVITY_ALREADY_STOPPED');
  }
  return serializeActivity(stoppedActivity);
}

async function getUserActivities(userId) {
  const activities = await Activity.find({ user: userId }).sort({ startTime: -1 });
  return activities.map(serializeActivity);
}

async function getTodayActivities(userId) {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const activities = await Activity.find({
    user: userId,
    startTime: { $lt: startOfTomorrow },
    $or: [{ endTime: null }, { endTime: { $gte: startOfToday } }],
  }).sort({ startTime: -1 });
  return activities.map(serializeActivity);
}

module.exports = {
  getTodayActivities,
  getUserActivities,
  startActivity,
  stopActivity,
};
