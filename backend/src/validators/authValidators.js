const AppError = require('../utils/AppError');

function requireObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR');
  }
  return value;
}

function validateEmail(value) {
  if (typeof value !== 'string') {
    throw new AppError('Enter a valid email address', 400, 'VALIDATION_ERROR');
  }
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('Enter a valid email address', 400, 'VALIDATION_ERROR');
  }
  return email;
}

function validateRegistration(body) {
  const data = requireObject(body);
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (name.length < 1 || name.length > 120) {
    throw new AppError('Name must be between 1 and 120 characters', 400, 'VALIDATION_ERROR');
  }
  const email = validateEmail(data.email);
  if (typeof data.password !== 'string' || data.password.length < 10
    || Buffer.byteLength(data.password, 'utf8') > 72) {
    throw new AppError('Password must be at least 10 characters and at most 72 bytes', 400, 'VALIDATION_ERROR');
  }
  return { name, email, password: data.password };
}

function validateLogin(body) {
  const data = requireObject(body);
  const email = validateEmail(data.email);
  if (typeof data.password !== 'string' || !data.password) {
    throw new AppError('Email and password are required', 400, 'VALIDATION_ERROR');
  }
  return { email, password: data.password };
}

function validateResend(body) {
  return { email: validateEmail(requireObject(body).email) };
}

function validateVerification(body) {
  const token = requireObject(body).token;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    throw new AppError('Verification link is invalid or has expired', 400, 'INVALID_VERIFICATION_TOKEN');
  }
  return { token };
}

module.exports = {
  validateRegistration,
  validateLogin,
  validateResend,
  validateVerification,
};
