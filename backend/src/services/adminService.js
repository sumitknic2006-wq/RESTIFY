const User = require('../models/User');
const Session = require('../models/Session');
const createAppError = require('../utils/appError');
const { getDatabaseStatus } = require('../config/db');

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 90;

function parseInteger(value, fallback, minimum, maximum, field) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) {
    throw createAppError(400, `${field} must be a whole number.`, 'VALIDATION_ERROR');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw createAppError(400, `${field} must be between ${minimum} and ${maximum}.`, 'VALIDATION_ERROR');
  }
  return parsed;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseUsersQuery(query = {}) {
  for (const key of Object.keys(query)) {
    if (!['page', 'limit', 'search', 'role'].includes(key)) {
      throw createAppError(400, `Unsupported user filter: ${key}.`, 'VALIDATION_ERROR');
    }
  }
  const page = parseInteger(query.page, 1, 1, 1000000, 'page');
  const limit = parseInteger(query.limit, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE, 'limit');
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search.length > 100) {
    throw createAppError(400, 'search must be 100 characters or fewer.', 'VALIDATION_ERROR');
  }
  const role = query.role || 'all';
  if (!['all', 'user', 'admin'].includes(role)) {
    throw createAppError(400, 'role must be all, user, or admin.', 'VALIDATION_ERROR');
  }
  return { page, limit, search, role };
}

function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role === 'admin' ? 'admin' : 'user',
    createdAt: user.createdAt,
  };
}

async function getUsers(query = {}) {
  const { page, limit, search, role } = parseUsersQuery(query);
  const filter = {};
  if (role !== 'all') filter.role = role;
  if (search) {
    const escaped = escapeRegex(search);
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ];
  }
  const total = await User.countDocuments(filter);
  const offset = (page - 1) * limit;
  const records = offset >= total
    ? []
    : await User.find(filter)
      .select('name email role createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
  return {
    users: records.map(serializeUser),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

async function getOverview(query = {}, now = new Date()) {
  for (const key of Object.keys(query)) {
    if (key !== 'days') throw createAppError(400, `Unsupported overview filter: ${key}.`, 'VALIDATION_ERROR');
  }
  const days = parseInteger(query.days, DEFAULT_RANGE_DAYS, 1, MAX_RANGE_DAYS, 'days');
  const end = new Date(now);
  const start = new Date(Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate() - days + 1
  ));
  const [registeredUsers, sessionSummary, dailySessions] = await Promise.all([
    User.countDocuments({}),
    Session.aggregate([
      { $match: { status: 'completed', endTime: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: null,
          completedCount: { $sum: 1 },
          recordedDurationSeconds: { $sum: '$durationSeconds' },
          focusCount: {
            $sum: { $cond: [{ $ne: ['$ruleId', null] }, 1, 0] },
          },
        },
      },
    ]),
    Session.aggregate([
      { $match: { status: 'completed', endTime: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$endTime', timezone: 'UTC' } },
          completedCount: { $sum: 1 },
          recordedDurationSeconds: { $sum: '$durationSeconds' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const summary = sessionSummary[0] || {
    completedCount: 0,
    recordedDurationSeconds: 0,
    focusCount: 0,
  };
  return {
    range: { start: start.toISOString(), end: end.toISOString(), days },
    registeredUsers,
    sessions: {
      completedCount: summary.completedCount,
      recordedDurationSeconds: summary.recordedDurationSeconds,
      focusCount: summary.focusCount,
      daily: dailySessions.map((item) => ({
        date: item._id,
        completedCount: item.completedCount,
        recordedDurationSeconds: item.recordedDurationSeconds,
      })),
    },
    services: { database: getDatabaseStatus().status },
  };
}

module.exports = { getOverview, getUsers, parseUsersQuery };
