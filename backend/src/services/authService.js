const bcrypt = require('bcryptjs');
const { randomBytes } = require('node:crypto');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const logger = require('../config/logger');
const { ensureMailConfigured, sendVerificationEmail } = require('../config/mail');
const sessionService = require('./sessionService');

const VERIFICATION_DURATION_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    country: user.country,
    emailVerified: Boolean(user.emailVerifiedAt),
  };
}

function createVerification() {
  const token = randomBytes(32).toString('hex');
  return {
    token,
    tokenHash: sessionService.hashToken(token),
    expiresAt: new Date(Date.now() + VERIFICATION_DURATION_MS),
    requestedAt: new Date(),
  };
}

async function deliverEmail(email, token) {
  try {
    await sendVerificationEmail(email, token);
  } catch (error) {
    // Do not log SMTP error objects or URLs: authentication secrets can appear in them.
    logger.warn({ code: error.code || 'SMTP_ERROR' }, 'Verification email delivery failed');
    throw new AppError('Unable to send verification email. Please try again later.', 503, 'EMAIL_DELIVERY_FAILED');
  }
}

async function register({ name, email, password }) {
  ensureMailConfigured();
  const existing = await User.exists({ email });
  if (existing) throw new AppError('An account with this email already exists', 409, 'EMAIL_EXISTS');

  const verification = createVerification();
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await User.create({
      name,
      email,
      passwordHash,
      country: 'XX', // Unknown ISO-style placeholder; registration does not request country.
      emailVerifiedAt: null,
      emailVerification: {
        tokenHash: verification.tokenHash,
        expiresAt: verification.expiresAt,
        requestedAt: verification.requestedAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) throw new AppError('An account with this email already exists', 409, 'EMAIL_EXISTS');
    throw error;
  }
  await deliverEmail(email, verification.token);
  return { message: 'Registration successful. Check your email for the verification link.' };
}

async function resendVerification({ email }) {
  ensureMailConfigured();
  const user = await User.findOne({ email });
  const neutralMessage = { message: 'If this is an unverified account, check your email for a verification link.' };
  if (!user || user.emailVerifiedAt) return neutralMessage;

  if (user.emailVerification?.requestedAt &&
      Date.now() - new Date(user.emailVerification.requestedAt).getTime() < RESEND_COOLDOWN_MS) {
    throw new AppError('Please wait at least one minute before requesting another email', 429, 'RESEND_COOLDOWN');
  }

  const verification = createVerification();
  // Atomic claim prevents overlapping resends from leaving several active URLs.
  const updated = await User.findOneAndUpdate({
    _id: user._id,
    emailVerifiedAt: null,
    $or: [
      { 'emailVerification.requestedAt': { $exists: false } },
      { 'emailVerification.requestedAt': { $lte: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
    ],
  }, {
    $set: {
      emailVerification: {
        tokenHash: verification.tokenHash,
        expiresAt: verification.expiresAt,
        requestedAt: verification.requestedAt,
      },
    },
  });
  if (!updated) throw new AppError('Please wait before requesting another email', 429, 'RESEND_COOLDOWN');
  try {
    await deliverEmail(email, verification.token);
  } catch (error) {
    // A failed SMTP attempt should not force a user to wait for the cooldown.
    await User.updateOne({
      _id: user._id,
      'emailVerification.tokenHash': verification.tokenHash,
    }, { $unset: { 'emailVerification.requestedAt': '' } });
    throw error;
  }
  return neutralMessage;
}

async function verifyEmail({ token }, req, res) {
  const user = await User.findOneAndUpdate({
    emailVerifiedAt: null,
    'emailVerification.tokenHash': sessionService.hashToken(token),
    'emailVerification.expiresAt': { $gt: new Date() },
  }, {
    $set: { emailVerifiedAt: new Date() },
    $unset: { emailVerification: '' },
  }, { new: true });

  if (!user) throw new AppError('Verification link is invalid or has expired', 400, 'INVALID_VERIFICATION_TOKEN');
  await sessionService.createSession(user._id, req, res);
  return { message: 'Email verified. You are signed in.', user: publicUser(user) };
}

async function login({ email, password }, req, res) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = user && await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  if (!user.emailVerifiedAt) throw new AppError('Please verify your email before signing in', 403, 'EMAIL_NOT_VERIFIED');
  await sessionService.createSession(user._id, req, res);
  return { message: 'Signed in successfully.', user: publicUser(user) };
}

async function findAuthenticatedUser(req) {
  return sessionService.findAuthenticatedUser(req);
}

async function logout(req, res) {
  await sessionService.revokeSession(req, res);
}

async function getStatus() {
  return {
    service: 'auth',
    status: 'available',
    message: 'Email authentication is available.',
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  register,
  resendVerification,
  verifyEmail,
  login,
  logout,
  findAuthenticatedUser,
  publicUser,
  getStatus,
};
