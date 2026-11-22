const CalendarShareLink = require('../models/CalendarShareLink');
const AppError = require('../utils/AppError');
const { hasCalendarRole } = require('../constants/calendarRoles');
const { matchesCalendarShareToken, parseCalendarShareToken } = require('../utils/calendarShareLink');

function unauthorized() {
  return new AppError('Calendar share link is invalid or has expired', 401, 'CALENDAR_SHARE_UNAUTHORIZED');
}

function readShareToken(req) {
  const authorization = req.get('authorization');
  if (typeof authorization !== 'string' || !authorization.startsWith('CalendarLink ')) return null;
  return parseCalendarShareToken(authorization.slice('CalendarLink '.length));
}

function requireCalendarShareLink(requiredRole) {
  return async (req, res, next) => {
    try {
      const supplied = readShareToken(req);
      if (!supplied) throw unauthorized();
      const link = await CalendarShareLink.findOne({
        prefix: supplied.prefix,
        status: 'active',
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } },
        ],
      }).select('+tokenHash');
      if (!link || !matchesCalendarShareToken(supplied.token, link.tokenHash)) {
        throw unauthorized();
      }
      if (!hasCalendarRole(link.role, requiredRole)) {
        throw new AppError('Calendar share link does not have the required access', 403, 'CALENDAR_SHARE_FORBIDDEN');
      }
      await CalendarShareLink.updateOne({ _id: link._id, status: 'active' }, { $set: { lastUsedAt: new Date() } });
      req.calendarShareLink = link;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { requireCalendarShareLink };
