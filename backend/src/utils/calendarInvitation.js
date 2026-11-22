const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto');
const config = require('../config/config');

function hashCalendarInvitationToken(token) {
  if (!config.security.calendarInvitationHashSecret) {
    throw new Error('CALENDAR_INVITATION_HASH_SECRET must be configured before calendar invitations can be used');
  }
  return createHmac('sha256', config.security.calendarInvitationHashSecret).update(token).digest('hex');
}

function createCalendarInvitationToken() {
  const prefix = `ci_${randomBytes(9).toString('base64url')}`;
  const token = randomBytes(32).toString('base64url');
  return { prefix, tokenHash: hashCalendarInvitationToken(token), rawToken: `${prefix}.${token}` };
}

function parseCalendarInvitationToken(value) {
  const match = typeof value === 'string'
    ? /^(ci_[A-Za-z0-9_-]{12})\.([A-Za-z0-9_-]{43})$/.exec(value)
    : null;
  return match ? { prefix: match[1], token: match[2] } : null;
}

function matchesCalendarInvitationToken(token, storedHash) {
  if (typeof storedHash !== 'string' || !/^[a-f0-9]{64}$/.test(storedHash)) return false;
  const expected = Buffer.from(hashCalendarInvitationToken(token), 'hex');
  const actual = Buffer.from(storedHash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

module.exports = {
  createCalendarInvitationToken,
  hashCalendarInvitationToken,
  matchesCalendarInvitationToken,
  parseCalendarInvitationToken,
};
