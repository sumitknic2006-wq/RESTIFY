const User = require('../models/User');
const createAppError = require('../utils/appError');
const { normalizePreferences } = require('./authService');
const { assertValidPreferences } = require('../validators/userPreferencesValidator');

async function updatePreferences(userId, input) {
  assertValidPreferences(input);
  const user = await User.findById(userId);
  if (!user) throw createAppError(401, 'Authentication required.', 'UNAUTHORIZED');

  const current = normalizePreferences(user.preferences);
  const updated = {
    theme: input.theme ?? current.theme,
    notifications: {
      ...current.notifications,
      ...(input.notifications || {}),
    },
  };
  user.preferences = updated;
  await user.save();
  return normalizePreferences(user.preferences);
}

module.exports = { updatePreferences };
