const Activity = require('../models/Activity');
const Achievement = require('../models/Achievement');
const Goal = require('../models/Goal');
const Session = require('../models/Session');
const analyticsService = require('./analyticsService');
const streakService = require('./streakService');
const notificationService = require('./notificationService');

const DAY_MS = 24 * 60 * 60 * 1000;
const ACHIEVEMENTS = [
  {
    id: 'first-tracked-day',
    name: 'Mindful Tracker',
    description: 'Complete your first screen-time tracking entry.',
  },
  {
    id: 'daily-goal-streak-3',
    name: 'Three-Day Consistency',
    description: 'Meet your daily screen-time goal on three consecutive tracked days.',
  },
  {
    id: 'weekly-goal-met',
    name: 'Weekly Balance',
    description: 'Meet your weekly screen-time goal for a completed tracked week.',
  },
];

function utcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function previousWeek(now) {
  const today = utcDay(now);
  const currentWeekStart = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY_MS);
  return { start: new Date(currentWeekStart.getTime() - 7 * DAY_MS), end: currentWeekStart };
}

async function hasTrackedEntry(userId) {
  const [activity, session] = await Promise.all([
    Activity.findOne({
      user: userId,
      endTime: { $ne: null },
      durationSeconds: { $gt: 0 },
    }).select('_id'),
    Session.findOne({
      user: userId,
      status: 'completed',
      durationSeconds: { $gt: 0 },
    }).select('_id'),
  ]);
  return Boolean(activity || session);
}

async function meetsWeeklyGoal(userId, now) {
  const goal = await Goal.findOne({ user: userId, period: 'weekly', isActive: true }).sort({
    updatedAt: -1,
  });
  if (!goal) return false;
  const period = previousWeek(now);
  const history = Array.isArray(goal.targetHistory) ? goal.targetHistory : [];
  const targetSnapshot = history
    .filter(
      (entry) =>
        entry.period === 'weekly' &&
        new Date(entry.effectiveFrom) <= period.start
    )
    .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom))[0];
  const targetMinutes =
    targetSnapshot?.targetMinutes ||
    (!history.length && new Date(goal.createdAt) <= period.start ? goal.targetMinutes : null);
  if (targetMinutes === null) return false;
  const analytics = await analyticsService.getAnalyticsForRange(
    userId,
    period.start,
    period.end,
    now
  );
  return (
    analytics.activities.length > 0 &&
    analytics.totalDurationSeconds <= targetMinutes * 60
  );
}

async function recordUnlock(userId, achievementId, now) {
  const filter = { user: userId, achievementId };
  try {
    await Achievement.updateOne(
      filter,
      { $setOnInsert: { user: userId, achievementId, unlockedAt: now } },
      { upsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  const achievement = ACHIEVEMENTS.find((item) => item.id === achievementId);
  await notificationService.createForUser(userId, {
    category: 'achievements',
    sourceKey: `achievement:${achievementId}`,
    title: `Achievement unlocked: ${achievement.name}`,
    message: achievement.description,
  });
}

async function getAchievements(userId, now = new Date()) {
  const [tracked, streak, weeklyGoalMet] = await Promise.all([
    hasTrackedEntry(userId),
    streakService.getStreak(userId, now),
    meetsWeeklyGoal(userId, now),
  ]);
  const eligibility = {
    'first-tracked-day': tracked,
    'daily-goal-streak-3': streak.longestStreak >= 3,
    'weekly-goal-met': weeklyGoalMet,
  };

  await Promise.all(
    ACHIEVEMENTS.filter((item) => eligibility[item.id]).map((item) =>
      recordUnlock(userId, item.id, now)
    )
  );
  const unlocked = await Achievement.find({ user: userId }).select('achievementId unlockedAt');
  const byId = new Map(unlocked.map((record) => [record.achievementId, record.unlockedAt]));
  return ACHIEVEMENTS.map((item) => ({
    ...item,
    unlocked: byId.has(item.id),
    unlockedAt: byId.get(item.id) || null,
  }));
}

module.exports = { ACHIEVEMENTS, getAchievements, hasTrackedEntry, meetsWeeklyGoal };
