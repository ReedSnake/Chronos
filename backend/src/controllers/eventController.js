const { getApiTarget } = require('../services/calendarApiAccessService');
const eventService = require('../services/eventService');
const { validateCalendarId } = require('../validators/calendarValidators');
const { validateEventCreate, validateEventUpdate, validateEventId, validateEventFilters } = require('../validators/eventValidators');

async function target(req, scope) {
  return await getApiTarget(req, scope) || req.authUser._id;
}

async function list(req, res) {
  const filters = validateEventFilters(req.query, { allowTargetUserId: true });
  res.status(200).json(await eventService.listCalendarEvents(
    await target(req, 'calendar:read'), validateCalendarId(req.params.id), filters,
  ));
}

async function get(req, res) {
  res.status(200).json({ event: await eventService.getCalendarEvent(
    await target(req, 'calendar:read'), validateCalendarId(req.params.id), validateEventId(req.params.eventId),
  ) });
}

async function create(req, res) {
  const values = validateEventCreate(req.body);
  res.status(201).json({ event: await eventService.createCalendarEvent(
    await target(req, 'calendar:write'), validateCalendarId(req.params.id), values,
  ) });
}

async function update(req, res) {
  res.status(200).json({ event: await eventService.updateCalendarEvent(
    await target(req, 'calendar:write'), validateCalendarId(req.params.id), validateEventId(req.params.eventId),
    (type) => validateEventUpdate(req.body, type),
  ) });
}

async function remove(req, res) {
  await eventService.deleteCalendarEvent(
    await target(req, 'calendar:write'), validateCalendarId(req.params.id), validateEventId(req.params.eventId),
  );
  res.status(204).end();
}

async function listShared(req, res) {
  res.status(200).json(await eventService.listSharedCalendarEvents(
    req.calendarShareLink, validateEventFilters(req.query),
  ));
}

module.exports = { list, get, create, update, remove, listShared };
