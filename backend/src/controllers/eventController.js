const { getApiTarget } = require('../services/calendarApiAccessService');
const eventService = require('../services/eventService');
const { validateCalendarId } = require('../validators/calendarValidators');
const { validateEventFilters } = require('../validators/eventValidators');

async function list(req, res) {
  const filters = validateEventFilters(req.query, { allowTargetUserId: true });
  const userId = await getApiTarget(req, 'calendar:read') || req.authUser._id;
  const data = await eventService.listCalendarEvents(
    userId,
    validateCalendarId(req.params.id),
    filters,
  );
  res.status(200).json(data);
}

async function listShared(req, res) {
  const data = await eventService.listSharedCalendarEvents(
    req.calendarShareLink,
    validateEventFilters(req.query),
  );
  res.status(200).json(data);
}

module.exports = { list, listShared };
