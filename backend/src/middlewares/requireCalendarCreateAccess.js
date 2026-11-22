const requireAuth = require('./requireAuth');
const { requireApiKey } = require('./requireApiKey');

const requireCalendarWrite = requireApiKey('calendar:write');
const requireCalendarRead = requireApiKey('calendar:read');
const requireCalendarDelete = requireApiKey('calendar:delete');

function requireCalendarCreateAccess(req, res, next) {
  if (req.get('authorization')?.startsWith('Bearer ')) {
    return requireCalendarWrite(req, res, next);
  }
  return requireAuth(req, res, next);
}

function requireCalendarReadAccess(req, res, next) {
  if (req.get('authorization')?.startsWith('Bearer ')) {
    return requireCalendarRead(req, res, next);
  }
  return requireAuth(req, res, next);
}

function requireCalendarWriteAccess(req, res, next) {
  if (req.get('authorization')?.startsWith('Bearer ')) {
    return requireCalendarWrite(req, res, next);
  }
  return requireAuth(req, res, next);
}

function requireCalendarDeleteAccess(req, res, next) {
  if (req.get('authorization')?.startsWith('Bearer ')) {
    return requireCalendarDelete(req, res, next);
  }
  return requireAuth(req, res, next);
}

module.exports = {
  requireCalendarCreateAccess,
  requireCalendarDeleteAccess,
  requireCalendarReadAccess,
  requireCalendarWriteAccess,
};
