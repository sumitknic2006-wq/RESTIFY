const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
const createAppError = require('../utils/appError');

const ALLOWED_CATEGORIES = new Set(['achievements', 'challenges', 'goals']);

function serialize(notification) {
  return {
    id: notification._id.toString(),
    category: notification.category,
    title: notification.title,
    message: notification.message,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}

async function createForUser(userId, { category, sourceKey, title, message }) {
  if (!ALLOWED_CATEGORIES.has(category)) throw new Error('Unsupported notification category.');
  const user = await User.findById(userId).select('preferences');
  if (!user || user.preferences?.notifications?.[category] === false) return null;
  try {
    return await Notification.findOneAndUpdate(
      { user: userId, sourceKey },
      {
        $setOnInsert: {
          user: userId,
          category,
          sourceKey,
          title,
          message,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    return Notification.findOne({ user: userId, sourceKey });
  }
}

async function listForUser(userId) {
  const filter = { user: userId, dismissedAt: null };
  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).limit(100),
    Notification.countDocuments({ ...filter, readAt: null }),
  ]);
  return { notifications: notifications.map(serialize), unreadCount };
}

async function updateOwned(userId, id, update) {
  if (!mongoose.isObjectIdOrHexString(id)) {
    throw createAppError(400, 'Notification ID is invalid.', 'INVALID_NOTIFICATION_ID');
  }
  const notification = await Notification.findOneAndUpdate(
    { _id: id, user: userId, dismissedAt: null },
    update,
    { new: true }
  );
  if (!notification) throw createAppError(404, 'Notification not found.', 'NOTIFICATION_NOT_FOUND');
  return serialize(notification);
}

async function markRead(userId, id) {
  return updateOwned(userId, id, { $set: { readAt: new Date() } });
}

async function dismiss(userId, id) {
  return updateOwned(userId, id, { $set: { dismissedAt: new Date() } });
}

async function markAllRead(userId) {
  const result = await Notification.updateMany(
    { user: userId, dismissedAt: null, readAt: null },
    { $set: { readAt: new Date() } }
  );
  return { updatedCount: result.modifiedCount };
}

module.exports = { createForUser, dismiss, listForUser, markAllRead, markRead };
