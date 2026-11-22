const calendarService = require('../services/calendarService');
const calendarShareService = require('../services/calendarShareService');
const {
  validateCalendarId,
  validateCalendarShareCreate,
  validateCalendarUpdate,
} = require('../validators/calendarValidators');
const { validateObjectId } = require('../validators/integrationValidators');

async function create(req, res) {
  const data = await calendarShareService.createCalendarShareLink(
    req.authUser._id,
    validateCalendarId(req.params.id),
    validateCalendarShareCreate(req.body),
  );
  res.status(201).json(data);
}

async function list(req, res) {
  const links = await calendarShareService.listCalendarShareLinks(
    req.authUser._id,
    validateCalendarId(req.params.id),
  );
  res.status(200).json({ links });
}

async function revoke(req, res) {
  await calendarShareService.revokeCalendarShareLink(
    req.authUser._id,
    validateCalendarId(req.params.id),
    validateObjectId(req.params.linkId, 'calendar share link ID'),
  );
  res.status(204).end();
}

async function getSharedCalendar(req, res) {
  res.status(200).json({ calendar: await calendarService.getCalendarForShareLink(req.calendarShareLink) });
}

async function updateSharedCalendar(req, res) {
  const calendar = await calendarService.updateCalendarForShareLink(
    req.calendarShareLink,
    validateCalendarUpdate(req.body),
  );
  res.status(200).json({ calendar });
}

module.exports = {
  create,
  getSharedCalendar,
  list,
  revoke,
  updateSharedCalendar,
};
