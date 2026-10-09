const jwt = require('jsonwebtoken');
const env = require('../config/env');
const createAppError = require('./appError');

const JWT_ISSUER = 'restify-api';
const JWT_AUDIENCE = 'restify-client';

function assertJWTConfiguration() {
  if (!env.JWT_SECRET || Buffer.byteLength(env.JWT_SECRET, 'utf8') < 32) {
    throw createAppError(
      500,
      'Authentication is not configured correctly.',
      'AUTH_CONFIGURATION_ERROR'
    );
  }
}

function getSecret() {
  assertJWTConfiguration();
  return env.JWT_SECRET;
}

function generateToken(userId, tokenVersion = 0) {
  return jwt.sign({ ver: tokenVersion }, getSecret(), {
    algorithm: 'HS256',
    subject: String(userId),
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

function verifyToken(token) {
  return jwt.verify(token, getSecret(), {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

module.exports = {
  assertJWTConfiguration,
  generateToken,
  verifyToken,
};
