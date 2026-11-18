const { createHash, randomBytes } = require('node:crypto');
const AuthSession = require('../models/AuthSession');
const User = require('../models/User');
const config = require('../config/config');

const COOKIE_NAME = 'chronos_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function cookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.auth.secureCookies || req.secure,
    path: '/',
  };
}

function readSessionToken(req) {
  const cookies = (req.headers.cookie || '').split(';');
  const item = cookies.find((entry) => entry.trim().startsWith(`${COOKIE_NAME}=`));
  if (!item) return null;
  const token = item.trim().slice(COOKIE_NAME.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

async function createSession(userId, req, res) {
  const token = randomBytes(32).toString('hex');
  await AuthSession.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  });
  res.cookie(COOKIE_NAME, token, {
    ...cookieOptions(req),
    maxAge: SESSION_DURATION_MS,
  });
}

async function findAuthenticatedUser(req) {
  const token = readSessionToken(req);
  if (!token) return null;
  const session = await AuthSession.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;
  return User.findOne({ _id: session.userId, emailVerifiedAt: { $ne: null } });
}

async function revokeSession(req, res) {
  const token = readSessionToken(req);
  if (token) await AuthSession.deleteOne({ tokenHash: hashToken(token) });
  res.clearCookie(COOKIE_NAME, cookieOptions(req));
}

module.exports = {
  hashToken,
  createSession,
  findAuthenticatedUser,
  revokeSession,
};
