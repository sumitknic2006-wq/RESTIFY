const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { comparePassword, hashPassword } = require('../utils/password');
const {
  normalizeEmail,
  validateLogin,
  validateRegister,
} = require('../validators/authValidator');
const createAppError = require('../utils/appError');

function assertValidInput(validator, input) {
  const errors = validator(input);

  if (errors.length > 0) {
    throw createAppError(400, 'Please correct the highlighted fields.', 'VALIDATION_ERROR', errors);
  }
}

function toSafeUser(user) {
  return {
    id: user.id || user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role === 'admin' ? 'admin' : 'user',
    preferences: normalizePreferences(user.preferences),
  };
}

function normalizePreferences(preferences = {}) {
  return {
    theme: ['system', 'light', 'dark'].includes(preferences.theme) ? preferences.theme : 'system',
    notifications: {
      achievements: preferences.notifications?.achievements !== false,
      challenges: preferences.notifications?.challenges !== false,
      goals: preferences.notifications?.goals !== false,
    },
  };
}

function createAuthResult(user) {
  return {
    user: toSafeUser(user),
    token: generateToken(user.id || user._id, user.tokenVersion || 0),
  };
}

async function register(input = {}) {
  assertValidInput(validateRegister, input);
  const { name, email, password } = input;
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail }).select('_id');

  if (existingUser) {
    throw createAppError(
      409,
      'An account with this email already exists.',
      'EMAIL_ALREADY_EXISTS'
    );
  }

  const passwordHash = await hashPassword(password);

  try {
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: passwordHash,
    });

    return createAuthResult(user);
  } catch (error) {
    if (error.code === 11000) {
      throw createAppError(
        409,
        'An account with this email already exists.',
        'EMAIL_ALREADY_EXISTS'
      );
    }

    throw error;
  }
}

async function login(input = {}) {
  assertValidInput(validateLogin, input);
  const { email, password } = input;
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail }).select('+password +tokenVersion');

  if (!user || !(await comparePassword(password, user.password))) {
    throw createAppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  return createAuthResult(user);
}

async function getCurrentUser(userId, tokenVersion = 0) {
  const user = await User.findById(userId).select('name email role preferences +tokenVersion');

  if (!user) {
    throw createAppError(401, 'Authentication required.', 'UNAUTHORIZED');
  }

  if (
    !Number.isSafeInteger(tokenVersion) ||
    tokenVersion < 0 ||
    (user.tokenVersion || 0) !== tokenVersion
  ) {
    throw createAppError(401, 'Authentication required.', 'UNAUTHORIZED');
  }

  return toSafeUser(user);
}

async function revokeUserTokens(userId) {
  const result = await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
  if (result.matchedCount !== 1) {
    throw createAppError(401, 'Authentication required.', 'UNAUTHORIZED');
  }
}

module.exports = {
  getCurrentUser,
  login,
  normalizePreferences,
  register,
  revokeUserTokens,
};
