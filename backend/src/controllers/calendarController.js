const calendarService = require('../services/calendarService');
const { getApiTarget, resolveApiTarget } = require('../services/calendarApiAccessService');
const {
  validateCalendarCreate,
  validateCalendarId,
  validateCalendarUpdate,
} = require('../validators/calendarValidators');

async function create(req, res) {
  const isApiKeyRequest = Boolean(req.apiPrincipal);
  const values = validateCalendarCreate(req.body, {
    allowTargetUserId: isApiKeyRequest,
    requireTargetUserId: false,
  });
  const requestedTargetUserId = values.targetUserId;
  delete values.targetUserId;
  const ownerUserId = isApiKeyRequest
    ? await resolveApiTarget(req.apiPrincipal, requestedTargetUserId, 'calendar:write')
    : req.authUser._id;
  const calendar = await calendarService.createCalendar(ownerUserId, values);
  res.status(201).json({ calendar });
}

async function list(req, res) {
  const targetUserId = await getApiTarget(req, 'calendar:read');
  const calendars = await calendarService.listCalendars(targetUserId || req.authUser._id);
  res.status(200).json({ calendars });
}

async function get(req, res) {
  const targetUserId = await getApiTarget(req, 'calendar:read');
  const calendar = await calendarService.getCalendarForUser(
    targetUserId || req.authUser._id,
    validateCalendarId(req.params.id),
  );
  res.status(200).json({ calendar });
}

async function update(req, res) {
  const targetUserId = await getApiTarget(req, 'calendar:write');
  const calendar = await calendarService.updateCalendarForUser(
    targetUserId || req.authUser._id,
    validateCalendarId(req.params.id),
    validateCalendarUpdate(req.body),
  );
  res.status(200).json({ calendar });
}

async function remove(req, res) {
  const targetUserId = await getApiTarget(req, 'calendar:delete');
  await calendarService.deleteCalendarForUser(
    targetUserId || req.authUser._id,
    validateCalendarId(req.params.id),
  );
  res.status(204).end();
}

module.exports = { create, get, list, remove, update };
