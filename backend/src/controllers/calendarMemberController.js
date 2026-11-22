const calendarMemberService = require('../services/calendarMemberService');
const {
  validateCalendarId,
  validateCalendarMemberCreate,
  validateCalendarMemberUpdate,
} = require('../validators/calendarValidators');
const { validateObjectId } = require('../validators/integrationValidators');

async function list(req, res) {
  const members = await calendarMemberService.listCalendarMembers(
    req.authUser._id,
    validateCalendarId(req.params.id),
  );
  res.status(200).json({ members });
}

async function create(req, res) {
  const member = await calendarMemberService.createCalendarMember(
    req.authUser._id,
    validateCalendarId(req.params.id),
    validateCalendarMemberCreate(req.body),
  );
  res.status(201).json({ member });
}

async function update(req, res) {
  const member = await calendarMemberService.updateCalendarMember(
    req.authUser._id,
    validateCalendarId(req.params.id),
    validateObjectId(req.params.memberId, 'calendar member ID'),
    validateCalendarMemberUpdate(req.body),
  );
  res.status(200).json({ member });
}

async function remove(req, res) {
  await calendarMemberService.removeCalendarMember(
    req.authUser._id,
    validateCalendarId(req.params.id),
    validateObjectId(req.params.memberId, 'calendar member ID'),
  );
  res.status(204).end();
}

module.exports = { create, list, remove, update };
