const Goal = require('../models/Goal');
const analyticsService = require('./analyticsService');

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function targetForDate(goal, date) {
  const targetHistory = Array.isArray(goal.targetHistory) ? goal.targetHistory : [];
  const applicable = targetHistory
    .filter((entry) => entry.period === 'daily' && new Date(entry.effectiveFrom) <= date)
    .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom))[0];
  if (applicable) return applicable.targetMinutes;
  if (!targetHistory.length && new Date(goal.createdAt) < date) return goal.targetMinutes;
  return null;
}

function calculateStreak(days, goal, now = new Date()) {
  const today = utcDay(now);
  const dates = new Set();
  for (const day of days) {
    const date = new Date(`${day.date}T00:00:00.000Z`);
    if (date >= today || date < utcDay(goal.createdAt)) continue;
    const targetMinutes = targetForDate(goal, date);
    if (
      targetMinutes !== null &&
      day.activities.length > 0 &&
      day.totalDurationSeconds <= targetMinutes * 60
    ) {
      dates.add(day.date);
    }
  }

  const sortedDates = [...dates].sort();
  let longestStreak = 0;
  let run = 0;
  let previous = null;
  for (const date of sortedDates) {
    const timestamp = Date.parse(`${date}T00:00:00.000Z`);
    run = previous !== null && timestamp === previous + DAY_MS ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = timestamp;
  }

  let currentStreak = 0;
  let cursor = new Date(today.getTime() - DAY_MS);
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    currentStreak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return {
    currentStreak,
    longestStreak,
    lastCompletionDate: sortedDates.at(-1) || null,
  };
}

async function getStreak(userId, now = new Date()) {
  const goal = await Goal.findOne({
    user: userId,
    $or: [{ period: 'daily' }, { 'targetHistory.period': 'daily' }],
  }).sort({ updatedAt: -1 });
  if (!goal) {
    return { currentStreak: 0, longestStreak: 0, lastCompletionDate: null, goalId: null };
  }

  const today = utcDay(now);
  const createdAt = new Date(goal.createdAt);
  const start = new Date(utcDay(createdAt).getTime() + DAY_MS);
  const days =
    start < today
      ? (await analyticsService.getAnalyticsForRange(userId, start, today, now)).days
      : [];
  const result = calculateStreak(days, goal, now);
  return {
    ...result,
    currentStreak: goal.period === 'daily' && goal.isActive ? result.currentStreak : 0,
    goalId: goal._id.toString(),
    timezone: 'UTC',
  };
}

module.exports = { calculateStreak, getStreak };
