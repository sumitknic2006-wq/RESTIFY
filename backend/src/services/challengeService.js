const Activity = require('../models/Activity');
const DailyChallenge = require('../models/DailyChallenge');
const Session = require('../models/Session');
const createAppError = require('../utils/appError');
const notificationService = require('./notificationService');

const CHALLENGE = {
  id: 'track-screen-time',
  name: 'Track your screen time',
  description: 'Complete at least one screen-time tracking entry today.',
};

function utcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function serializeChallenge(record, date) {
  return {
    ...CHALLENGE,
    date: date.toISOString().slice(0, 10),
    completed: Boolean(record),
    completedAt: record?.completedAt || null,
  };
}

async function getTodayChallenge(userId, now = new Date()) {
  const date = utcDay(now);
  const record = await DailyChallenge.findOne({ user: userId, date });
  return serializeChallenge(record, date);
}

async function hasQualifyingTracking(userId, start, end) {
  const timeRange = {
    user: userId,
    startTime: { $lt: end },
    endTime: { $gte: start },
    durationSeconds: { $gt: 0 },
  };
  const [activity, session] = await Promise.all([
    Activity.findOne(timeRange).select('_id'),
    Session.findOne({ ...timeRange, status: 'completed' }).select('_id'),
  ]);
  return Boolean(activity || session);
}

async function completeTodayChallenge(userId, now = new Date()) {
  const date = utcDay(now);
  const end = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  const filter = { user: userId, date };
  const existing = await DailyChallenge.findOne(filter);
  if (existing) {
    await notifyChallengeComplete(userId, date);
    return serializeChallenge(existing, date);
  }
  if (!(await hasQualifyingTracking(userId, date, end))) {
    throw createAppError(
      409,
      'Complete a screen-time tracking entry before claiming this challenge.',
      'CHALLENGE_NOT_MET'
    );
  }

  try {
    const result = await DailyChallenge.updateOne(
      filter,
      {
        $setOnInsert: {
          user: userId,
          date,
          challengeId: CHALLENGE.id,
          completedAt: now,
        },
      },
      { upsert: true }
    );
    if (result?.upsertedCount) await notifyChallengeComplete(userId, date);
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  const record = await DailyChallenge.findOne(filter);
  return serializeChallenge(record, date);
}

async function notifyChallengeComplete(userId, date) {
  await notificationService.createForUser(userId, {
    category: 'challenges',
    sourceKey: `challenge:${CHALLENGE.id}:${date.toISOString().slice(0, 10)}`,
    title: 'Daily challenge completed',
    message: `You completed "${CHALLENGE.name}". Keep building your mindful tracking habit.`,
  });
}

module.exports = { CHALLENGE, completeTodayChallenge, getTodayChallenge, hasQualifyingTracking };
