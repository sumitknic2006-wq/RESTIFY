const Activity = require('../models/Activity');
const Session = require('../models/Session');
const createAppError = require('../utils/appError');

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_ACTIVITY = 'Unattributed session';

function utcDate(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function createPeriod(type, now = new Date()) {
  const today = utcDate(now);
  if (type === 'today') {
    return { start: today, end: new Date(today.getTime() + DAY_MS), unit: 'day' };
  }
  if (type === 'weekly') {
    const start = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY_MS);
    return { start, end: new Date(start.getTime() + 7 * DAY_MS), unit: 'day' };
  }
  if (type === 'monthly') {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return {
      start,
      end: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1)),
      unit: 'day',
    };
  }
  if (type === 'heatmap') {
    const start = new Date(today.getTime() - 29 * DAY_MS);
    return { start, end: new Date(today.getTime() + DAY_MS), unit: 'day' };
  }
  throw createAppError(500, 'Analytics period is not supported.', 'ANALYTICS_PERIOD_ERROR');
}

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function makeInterval(start, end, activity, target = null, priority = 0) {
  const startDate = validDate(start);
  const endDate = validDate(end);
  if (!startDate || !endDate || endDate <= startDate) return null;
  return {
    start: startDate.getTime(),
    end: endDate.getTime(),
    activity,
    target: target || null,
    priority,
  };
}

function activityIntervals(records, now) {
  return records
    .map((record) => {
      if (typeof record.activity !== 'string' || !record.activity.trim()) return null;
      const start = validDate(record.startTime);
      if (!start) return null;
      const end = record.endTime ? validDate(record.endTime) : now;
      return end
        ? makeInterval(start, end, record.activity, record.target, 0)
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

function sessionIntervals(records, now) {
  const intervals = [];
  for (const record of records) {
    const activity = record.ruleSnapshot?.activity || SESSION_ACTIVITY;
    const target = record.ruleSnapshot?.target || null;
    const start = validDate(record.startTime);
    if (!start) continue;
    const hardEnd =
      record.status === 'completed'
        ? validDate(record.endTime)
        : record.status === 'active'
          ? now
          : null;
    if (record.status === 'completed' && !hardEnd) continue;
    const pauses = Array.isArray(record.pauseHistory) ? record.pauseHistory : [];
    let activeStart = start;
    let invalid = false;

    for (const pause of pauses) {
      const pauseStart = validDate(pause.startTime);
      if (
        !pauseStart ||
        pauseStart < activeStart ||
        (hardEnd && pauseStart > hardEnd)
      ) {
        invalid = true;
        break;
      }
      const segment = makeInterval(activeStart, pauseStart, activity, target, 1);
      if (segment) intervals.push(segment);
      if (!pause.endTime) {
        activeStart = null;
        break;
      }
      const pauseEnd = validDate(pause.endTime);
      if (!pauseEnd || pauseEnd < pauseStart || (hardEnd && pauseEnd > hardEnd)) {
        invalid = true;
        break;
      }
      activeStart = pauseEnd;
    }
    if (invalid || !activeStart) continue;

    let end;
    if (record.status === 'active') {
      end = record.lastResumedAt ? hardEnd : null;
    } else if (record.status === 'completed') {
      end = hardEnd;
    } else if (record.status === 'paused') {
      end = null;
    }
    const segment = end && makeInterval(activeStart, end, activity, target, 1);
    if (segment) intervals.push(segment);
  }
  return intervals;
}

function subtractIntervals(interval, blockers) {
  let pieces = [{ start: interval.start, end: interval.end }];
  for (const blocker of blockers) {
    const next = [];
    for (const piece of pieces) {
      if (blocker.end <= piece.start || blocker.start >= piece.end) {
        next.push(piece);
      } else {
        if (blocker.start > piece.start) next.push({ start: piece.start, end: blocker.start });
        if (blocker.end < piece.end) next.push({ start: blocker.end, end: piece.end });
      }
    }
    pieces = next;
    if (!pieces.length) break;
  }
  return pieces;
}

function deduplicateIntervals(activities, sessions) {
  const acceptedActivities = [];
  for (const activity of activities) {
    const remaining = subtractIntervals(activity, acceptedActivities);
    acceptedActivities.push(
      ...remaining.map((piece) => ({ ...activity, ...piece }))
    );
  }
  const acceptedSessions = [];
  const blockers = [...acceptedActivities];
  for (const session of sessions.sort((a, b) => a.start - b.start || a.end - b.end)) {
    const remaining = subtractIntervals(session, blockers);
    const pieces = remaining.map((piece) => ({ ...session, ...piece }));
    acceptedSessions.push(...pieces);
    blockers.push(...pieces);
  }
  return [...acceptedActivities, ...acceptedSessions];
}

function createBuckets(period) {
  const buckets = [];
  for (let start = period.start.getTime(); start < period.end.getTime(); start += DAY_MS) {
    const date = new Date(start);
    buckets.push({
      date: formatDate(date),
      start: start,
      end: Math.min(start + DAY_MS, period.end.getTime()),
      totalDurationSeconds: 0,
      activities: new Map(),
    });
  }
  return buckets;
}

function aggregateIntervals(intervals, period) {
  const buckets = createBuckets(period);
  for (const interval of intervals) {
    for (const bucket of buckets) {
      const start = Math.max(interval.start, bucket.start, period.start.getTime());
      const end = Math.min(interval.end, bucket.end, period.end.getTime());
      if (end <= start) continue;

      const key = `${interval.activity}\u0000${interval.target || ''}`;
      const activity = bucket.activities.get(key) || {
        activity: interval.activity,
        target: interval.target,
        durationMilliseconds: 0,
      };
      activity.durationMilliseconds += end - start;
      bucket.activities.set(key, activity);
    }
  }

  return buckets.map((bucket) => {
    const activities = [...bucket.activities.values()]
      .map(({ activity, target, durationMilliseconds }) => ({
        activity,
        target,
        durationSeconds: Math.floor(durationMilliseconds / 1000),
      }))
      .filter((entry) => entry.durationSeconds > 0)
      .sort((a, b) => b.durationSeconds - a.durationSeconds);
    const totalDurationSeconds = activities.reduce(
      (total, activity) => total + activity.durationSeconds,
      0
    );
    return { date: bucket.date, totalDurationSeconds, activities };
  });
}

async function aggregateRange(userId, period, now = new Date()) {
  const range = {
    startTime: { $lt: period.end },
    $or: [{ endTime: null }, { endTime: { $gte: period.start } }],
  };
  const [activityRecords, sessionRecords] = await Promise.all([
    Activity.find({ user: userId, ...range }).select(
      'activity target startTime endTime durationSeconds'
    ),
    Session.find({
      user: userId,
      status: { $in: ['active', 'paused', 'completed'] },
      ...range,
    }).select(
      'startTime endTime status lastResumedAt pauseHistory durationSeconds ruleSnapshot'
    ),
  ]);

  const nowDate = validDate(now) || new Date();
  const intervals = deduplicateIntervals(
    activityIntervals(activityRecords, nowDate),
    sessionIntervals(sessionRecords, nowDate)
  );
  const daily = aggregateIntervals(intervals, period);
  const activityTotals = new Map();

  for (const day of daily) {
    for (const item of day.activities) {
      const key = `${item.activity}\u0000${item.target || ''}`;
      const total = activityTotals.get(key) || {
        activity: item.activity,
        target: item.target,
        durationSeconds: 0,
      };
      total.durationSeconds += item.durationSeconds;
      activityTotals.set(key, total);
    }
  }

  const activities = [...activityTotals.values()].sort(
    (a, b) => b.durationSeconds - a.durationSeconds || a.activity.localeCompare(b.activity)
  );
  const totalDurationSeconds = daily.reduce(
    (total, day) => total + day.totalDurationSeconds,
    0
  );

  return {
    period: {
      start: period.start.toISOString(),
      end: period.end.toISOString(),
      timezone: 'UTC',
    },
    totalDurationSeconds,
    activities,
    days: daily,
  };
}

async function getAnalytics(userId, periodName, now = new Date()) {
  return aggregateRange(userId, createPeriod(periodName, now), now);
}

async function getAnalyticsForRange(userId, start, end, now = new Date()) {
  const startDate = validDate(start);
  const endDate = validDate(end);
  if (!startDate || !endDate || endDate <= startDate) {
    throw createAppError(400, 'Analytics date range is invalid.', 'INVALID_ANALYTICS_RANGE');
  }
  return aggregateRange(userId, { start: startDate, end: endDate, unit: 'day' }, now);
}

async function getTodayAnalytics(userId) {
  const result = await getAnalytics(userId, 'today');
  return { ...result, today: result.days[0] };
}

async function getWeeklyAnalytics(userId) {
  return getAnalytics(userId, 'weekly');
}

async function getMonthlyAnalytics(userId) {
  return getAnalytics(userId, 'monthly');
}

async function getActivityRanking(userId) {
  const result = await getAnalytics(userId, 'monthly');
  return {
    period: result.period,
    ranking: result.activities.map((item, index) => ({ rank: index + 1, ...item })),
  };
}

async function getHeatmap(userId) {
  const result = await getAnalytics(userId, 'heatmap');
  return {
    period: result.period,
    unit: 'day',
    cells: result.days.map(({ date, totalDurationSeconds }) => ({
      date,
      durationSeconds: totalDurationSeconds,
    })),
  };
}

module.exports = {
  getActivityRanking,
  getAnalytics,
  getAnalyticsForRange,
  getHeatmap,
  getMonthlyAnalytics,
  getTodayAnalytics,
  getWeeklyAnalytics,
};
