const notificationService = require('../services/notificationService');
const { sendSuccess } = require('../utils/response');

async function list(req, res, next) {
  try {
    const { notifications, unreadCount } = await notificationService.listForUser(req.user.id);
    return sendSuccess(res, 200, 'Notifications retrieved successfully.', {
      notifications,
      unreadCount,
    });
  } catch (error) {
    return next(error);
  }
}

async function markRead(req, res, next) {
  try {
    const notification = await notificationService.markRead(req.user.id, req.params.id);
    return sendSuccess(res, 200, 'Notification marked as read.', { notification });
  } catch (error) {
    return next(error);
  }
}

async function dismiss(req, res, next) {
  try {
    const notification = await notificationService.dismiss(req.user.id, req.params.id);
    return sendSuccess(res, 200, 'Notification dismissed.', { notification });
  } catch (error) {
    return next(error);
  }
}

async function markAllRead(req, res, next) {
  try {
    const result = await notificationService.markAllRead(req.user.id);
    return sendSuccess(res, 200, 'Notifications marked as read.', result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { dismiss, list, markAllRead, markRead };
