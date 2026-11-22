const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto');
const config = require('../config/config');

const PREFIX_LENGTH = 12;
const TOKEN_LENGTH = 43;

function getHashSecret() {
  if (!config.security.calendarShareHashSecret) {
    throw new Error('CALENDAR_SHARE_HASH_SECRET must be configured before share links can be used');
  }
  return config.security.calendarShareHashSecret;
}

function hashCalendarShareToken(token) {
  return createHmac('sha256', getHashSecret()).update(token).digest('hex');
}

function createCalendarShareToken() {
  const prefix = `cs_${randomBytes(9).toString('base64url')}`;
  const token = randomBytes(32).toString('base64url');
  return { prefix, tokenHash: hashCalendarShareToken(token), rawToken: `${prefix}.${token}` };
}

function parseCalendarShareToken(value) {
  if (typeof value !== 'string') return null;
  const match = new RegExp(`^(cs_[A-Za-z0-9_-]{${PREFIX_LENGTH}})\\.([A-Za-z0-9_-]{${TOKEN_LENGTH}})$`).exec(value);
  if (!match) return null;
  return { prefix: match[1], token: match[2] };
}

function matchesCalendarShareToken(token, storedHash) {
  if (typeof storedHash !== 'string' || !/^[a-f0-9]{64}$/.test(storedHash)) return false;
  const expected = Buffer.from(hashCalendarShareToken(token), 'hex');
  const actual = Buffer.from(storedHash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

module.exports = {
  createCalendarShareToken,
  hashCalendarShareToken,
  matchesCalendarShareToken,
  parseCalendarShareToken,
};
