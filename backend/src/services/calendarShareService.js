const config = require('../config/config');
const CalendarShareLink = require('../models/CalendarShareLink');
const AppError = require('../utils/AppError');
const { createCalendarShareToken } = require('../utils/calendarShareLink');
const { getUserCalendarAccess } = require('./calendarService');

function shareLinkResponse(link) {
  return {
    id: String(link._id),
    role: link.role,
    prefix: link.prefix,
    status: link.status,
    expiresAt: link.expiresAt,
    lastUsedAt: link.lastUsedAt || null,
    revokedAt: link.revokedAt || null,
    createdAt: link.createdAt || null,
  };
}

function createShareUrl(rawToken) {
  if (!config.mail.frontendUrl) {
    throw new AppError('Calendar share links are not configured', 503, 'CALENDAR_SHARE_NOT_CONFIGURED');
  }
  const url = new URL('/calendar-share', config.mail.frontendUrl);
  // The fragment is never sent to the server or third-party referrers.
  url.hash = `token=${encodeURIComponent(rawToken)}`;
  return url.toString();
}

async function createCalendarShareLink(userId, calendarId, { role, expiresInMinutes }) {
  await getUserCalendarAccess(userId, calendarId, 'admin');
  if (!config.mail.frontendUrl) {
    throw new AppError('Calendar share links are not configured', 503, 'CALENDAR_SHARE_NOT_CONFIGURED');
  }
  const expiresAt = expiresInMinutes === null
    ? null
    : new Date(Date.now() + expiresInMinutes * 60 * 1000);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const generated = createCalendarShareToken();
    try {
      const link = await CalendarShareLink.create({
        calendarId,
        createdByUserId: userId,
        role,
        prefix: generated.prefix,
        tokenHash: generated.tokenHash,
        expiresAt,
      });
      return { link: shareLinkResponse(link), shareUrl: createShareUrl(generated.rawToken) };
    } catch (error) {
      if (error?.code !== 11000 || attempt === 2) throw error;
    }
  }
  throw new AppError('Unable to create calendar share link', 503, 'CALENDAR_SHARE_CREATION_FAILED');
}

async function listCalendarShareLinks(userId, calendarId) {
  await getUserCalendarAccess(userId, calendarId, 'admin');
  const links = await CalendarShareLink.find({ calendarId }).sort({ createdAt: -1, _id: -1 });
  return links.map(shareLinkResponse);
}

async function revokeCalendarShareLink(userId, calendarId, linkId) {
  await getUserCalendarAccess(userId, calendarId, 'admin');
  const link = await CalendarShareLink.findOneAndUpdate({
    _id: linkId,
    calendarId,
    status: 'active',
  }, {
    $set: { status: 'revoked', revokedAt: new Date() },
  }, { new: true });
  if (!link) throw new AppError('Calendar share link not found', 404, 'CALENDAR_SHARE_NOT_FOUND');
}

module.exports = {
  createCalendarShareLink,
  listCalendarShareLinks,
  revokeCalendarShareLink,
  shareLinkResponse,
};
