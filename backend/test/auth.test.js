process.env.JWT_SECRET = 'test-only-secret-that-is-at-least-32-bytes';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const User = require('../src/models/User');
const authService = require('../src/services/authService');
const env = require('../src/config/env');
const createAppError = require('../src/utils/appError');
const { generateToken, verifyToken } = require('../src/utils/jwt');
const { assertJWTConfiguration } = require('../src/utils/jwt');
const { comparePassword, hashPassword, isPasswordHash } = require('../src/utils/password');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function post(path, body, headers = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('registration validates input and sends safe response data', async () => {
  const originalRegister = authService.register;
  authService.register = async ({ email }) => ({
    user: { id: 'user-1', name: 'Test User', email: email.toLowerCase() },
    token: 'signed-token',
  });

  try {
    const invalidResponse = await post('/api/auth/register', {});
    assert.equal(invalidResponse.status, 400);
    assert.equal((await invalidResponse.json()).code, 'VALIDATION_ERROR');

    const nonObjectResponse = await post('/api/auth/register', null);
    assert.equal(nonObjectResponse.status, 400);

    const response = await post('/api/auth/register', {
      name: 'Test User',
      email: 'TEST@example.com',
      password: 'securePass123',
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.data.user.email, 'test@example.com');
    assert.equal(payload.data.token, 'signed-token');
    assert.equal('password' in payload.data.user, false);
  } finally {
    authService.register = originalRegister;
  }
});

test('duplicate registration returns conflict without leaking internal details', async () => {
  const originalRegister = authService.register;
  authService.register = async () => {
    throw createAppError(409, 'An account with this email already exists.', 'EMAIL_ALREADY_EXISTS');
  };

  try {
    const response = await post('/api/auth/register', {
      name: 'Test User',
      email: 'duplicate@example.com',
      password: 'securePass123',
    });
    const payload = await response.json();
    assert.equal(response.status, 409);
    assert.equal(payload.code, 'EMAIL_ALREADY_EXISTS');
    assert.equal('stack' in payload, false);
  } finally {
    authService.register = originalRegister;
  }
});

test('login returns a token and invalid credentials use a generic unauthorized response', async () => {
  const originalLogin = authService.login;
  authService.login = async ({ email }) => {
    if (email === 'wrong@example.com') {
      throw createAppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
    }
    return {
      user: { id: 'user-2', name: 'Test User', email: 'test@example.com' },
      token: 'signed-token',
    };
  };

  try {
    const validResponse = await post('/api/auth/login', {
      email: 'test@example.com',
      password: 'securePass123',
    });
    const validPayload = await validResponse.json();
    assert.equal(validResponse.status, 200);
    assert.equal(validPayload.data.token, 'signed-token');

    const invalidResponse = await post('/api/auth/login', {
      email: 'wrong@example.com',
      password: 'incorrect123',
    });
    const invalidPayload = await invalidResponse.json();
    assert.equal(invalidResponse.status, 401);
    assert.equal(invalidPayload.message, 'Invalid email or password.');
  } finally {
    authService.login = originalLogin;
  }
});

test('/me rejects missing and invalid tokens and returns safe user data for valid tokens', async () => {
  const originalGetCurrentUser = authService.getCurrentUser;
  authService.getCurrentUser = async (id) => {
    if (id === 'missing-user') {
      throw createAppError(401, 'Authentication required.', 'UNAUTHORIZED');
    }
    return { id, name: 'Test User', email: 'test@example.com' };
  };

  try {
    const missing = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(missing.status, 401);

    const invalid = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer invalid.token.value' },
    });
    assert.equal(invalid.status, 401);

    const malformed = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer' },
    });
    assert.equal(malformed.status, 401);

    const expiredToken = jwt.sign({}, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      subject: 'expired-user',
      issuer: 'restify-api',
      audience: 'restify-client',
      expiresIn: '-1s',
    });
    const expired = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(expired.status, 401);

    const token = generateToken('user-3');
    const valid = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await valid.json();
    assert.equal(valid.status, 200);
    assert.equal(payload.data.user.id, 'user-3');
    assert.equal(payload.data.user.name, 'Test User');
    assert.equal(payload.data.user.email, 'test@example.com');
    assert.equal('password' in payload.data.user, false);

    const deletedUserToken = generateToken('missing-user');
    const deletedUser = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${deletedUserToken}` },
    });
    assert.equal(deletedUser.status, 401);
  } finally {
    authService.getCurrentUser = originalGetCurrentUser;
  }
});

test('logout requires authentication, invalidates account tokens, and keeps health available', async () => {
  const originalGetCurrentUser = authService.getCurrentUser;
  const originalRevokeUserTokens = authService.revokeUserTokens;
  let revokedUserId;
  let currentVersion = 0;
  authService.getCurrentUser = async (id, tokenVersion = 0) => {
    if (tokenVersion !== currentVersion) {
      throw createAppError(401, 'Authentication required.', 'UNAUTHORIZED');
    }
    return { id, name: 'Test User', email: 'test@example.com' };
  };
  authService.revokeUserTokens = async (id) => {
    revokedUserId = id;
    currentVersion += 1;
  };

  let logoutResponse;
  const token = generateToken('logout-user');
  try {
    const unauthenticated = await post('/api/auth/logout', {});
    assert.equal(unauthenticated.status, 401);
    logoutResponse = await post('/api/auth/logout', {}, {
      Authorization: `Bearer ${token}`,
    });
    const reusedToken = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(reusedToken.status, 401);
  } finally {
    authService.getCurrentUser = originalGetCurrentUser;
    authService.revokeUserTokens = originalRevokeUserTokens;
  }

  const logoutPayload = await logoutResponse.json();
  assert.equal(logoutResponse.status, 200);
  assert.match(logoutPayload.message, /tokens have been invalidated/);
  assert.equal(revokedUserId, 'logout-user');

  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).service, 'restify-backend');
});

test('authentication service normalizes registration email and stores only bcrypt hashes', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  let createdUser;

  User.findOne = () => ({ select: async () => null });
  User.create = async (values) => {
    createdUser = values;
    return { ...values, id: 'service-user-1', _id: 'service-user-1' };
  };

  try {
    const result = await authService.register({
      name: ' Test User ',
      email: '  TEST@Example.com ',
      password: 'securePass123',
    });
    assert.equal(createdUser.email, 'test@example.com');
    assert.equal(createdUser.name, 'Test User');
    assert.notEqual(createdUser.password, 'securePass123');
    assert.equal(isPasswordHash(createdUser.password), true);
    assert.equal(await comparePassword('securePass123', createdUser.password), true);
    assert.deepEqual(Object.keys(result.user).sort(), ['email', 'id', 'name', 'preferences', 'role']);
    assert.equal(result.user.role, 'user');
    assert.deepEqual(result.user.preferences, {
      theme: 'system',
      notifications: { achievements: true, challenges: true, goals: true },
    });
    assert.equal(verifyToken(result.token).sub, 'service-user-1');
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
  }
});

test('authentication service maps duplicate-key races to conflict', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  User.findOne = () => ({ select: async () => null });
  User.create = async () => {
    const error = new Error('duplicate key');
    error.code = 11000;
    throw error;
  };

  try {
    await assert.rejects(
      authService.register({
        name: 'Test User',
        email: 'duplicate@example.com',
        password: 'securePass123',
      }),
      (error) => error.statusCode === 409 && error.code === 'EMAIL_ALREADY_EXISTS'
    );
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
  }
});

test('authentication service validates input before database access', async () => {
  await assert.rejects(
    authService.register({ name: '', email: 'invalid', password: 'short' }),
    (error) => error.statusCode === 400 && error.code === 'VALIDATION_ERROR'
  );
  await assert.rejects(
    authService.login({ email: 'invalid', password: '' }),
    (error) => error.statusCode === 400 && error.code === 'VALIDATION_ERROR'
  );
});

test('authentication service checks and revokes persisted token versions', async () => {
  const originalFindById = User.findById;
  const originalUpdateOne = User.updateOne;
  let update;
  User.findById = () => ({
    select: async () => ({
      _id: 'versioned-user',
      id: 'versioned-user',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      tokenVersion: 2,
    }),
  });
  User.updateOne = async (...args) => {
    update = args;
    return { matchedCount: 1 };
  };

  try {
    const user = await authService.getCurrentUser('versioned-user', 2);
    assert.equal(user.id, 'versioned-user');
    await assert.rejects(
      authService.getCurrentUser('versioned-user', 1),
      (error) => error.statusCode === 401 && error.code === 'UNAUTHORIZED'
    );
    await authService.revokeUserTokens('versioned-user');
    assert.deepEqual(update, [
      { _id: 'versioned-user' },
      { $inc: { tokenVersion: 1 } },
    ]);
  } finally {
    User.findById = originalFindById;
    User.updateOne = originalUpdateOne;
  }
});

test('password hashing and comparison work and User serialization excludes hashes', async () => {
  const passwordHash = await hashPassword('securePass123');
  assert.notEqual(passwordHash, 'securePass123');
  assert.equal(isPasswordHash(passwordHash), true);
  assert.equal(await comparePassword('securePass123', passwordHash), true);
  assert.equal(await comparePassword('wrong-password', passwordHash), false);

  const user = new User({
    name: 'Test User',
    email: 'TEST@example.com',
    password: passwordHash,
    tokenVersion: 3,
  });
  const safeUser = user.toJSON();

  assert.equal(user.email, 'test@example.com');
  assert.equal(User.schema.path('password').options.select, false);
  assert.equal('password' in safeUser, false);
  assert.equal('tokenVersion' in safeUser, false);
});

test('JWT contains only its subject, expiry, and server token-version claim', () => {
  const token = generateToken('user-4');
  const payload = verifyToken(token);

  assert.equal(payload.sub, 'user-4');
  assert.equal(typeof payload.exp, 'number');
  assert.equal(payload.ver, 0);
  assert.equal('email' in payload, false);
  assert.equal('password' in payload, false);
});

test('JWT configuration rejects missing and weak secrets without exposing values', () => {
  const originalSecret = env.JWT_SECRET;

  try {
    for (const invalidSecret of ['', 'too-short']) {
      env.JWT_SECRET = invalidSecret;
      assert.throws(
        () => assertJWTConfiguration(),
        (error) =>
          error.code === 'AUTH_CONFIGURATION_ERROR' &&
          error.message === 'Authentication is not configured correctly.'
      );
    }
  } finally {
    env.JWT_SECRET = originalSecret;
  }
});

test('repeated failed auth attempts are rate limited', async () => {
  const originalLogin = authService.login;
  authService.login = async () => {
    throw createAppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  };

  try {
    let limited = false;

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await post('/api/auth/login', {
        email: 'rate-limit@example.com',
        password: 'valid-format-password',
      });
      if (response.status === 429) {
        const payload = await response.json();
        assert.equal(payload.code, 'RATE_LIMITED');
        limited = true;
        break;
      }
    }

    assert.equal(limited, true);
  } finally {
    authService.login = originalLogin;
  }
});
