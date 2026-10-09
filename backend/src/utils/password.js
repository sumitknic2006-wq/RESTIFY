const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

function isPasswordHash(value) {
  return typeof value === 'string' && BCRYPT_HASH_PATTERN.test(value);
}

function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = {
  comparePassword,
  hashPassword,
  isPasswordHash,
};
