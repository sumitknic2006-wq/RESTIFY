const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function asObject(body) {
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

function validateEmail(email, errors) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    errors.push({ field: 'email', message: 'Email is required.' });
  } else if (normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) {
    errors.push({ field: 'email', message: 'Enter a valid email address.' });
  }
}

function validateRegister(body = {}) {
  body = asObject(body);
  const errors = [];
  const name = typeof body.name === 'string' ? body.name.trim() : '';

  if (!name) {
    errors.push({ field: 'name', message: 'Name is required.' });
  } else if (name.length > 80) {
    errors.push({ field: 'name', message: 'Name must be 80 characters or fewer.' });
  }

  validateEmail(body.email, errors);

  if (typeof body.password !== 'string' || body.password.length < MIN_PASSWORD_LENGTH) {
    errors.push({
      field: 'password',
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
  } else if (Buffer.byteLength(body.password, 'utf8') > MAX_PASSWORD_BYTES) {
    errors.push({
      field: 'password',
      message: 'Password must be no more than 72 bytes.',
    });
  }

  return errors;
}

function validateLogin(body = {}) {
  body = asObject(body);
  const errors = [];
  validateEmail(body.email, errors);

  if (typeof body.password !== 'string' || body.password.length === 0) {
    errors.push({ field: 'password', message: 'Password is required.' });
  } else if (Buffer.byteLength(body.password, 'utf8') > MAX_PASSWORD_BYTES) {
    errors.push({ field: 'password', message: 'Password must be no more than 72 bytes.' });
  }

  return errors;
}

module.exports = {
  normalizeEmail,
  validateLogin,
  validateRegister,
};
