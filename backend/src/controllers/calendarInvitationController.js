const invitationService = require('../services/calendarInvitationService');
const {
  validateCalendarId,
  validateCalendarInvitationBulkCreate,
  validateCalendarInvitationCreate,
  validateCalendarInvitationToken,
} = require('../validators/calendarValidators');
const { validateObjectId } = require('../validators/integrationValidators');
const { requestLocale } = require('../utils/requestLocale');

async function create(req, res) {
  const data = await invitationService.createCalendarInvitation(
    req.authUser._id,
    validateCalendarId(req.params.id),
    validateCalendarInvitationCreate(req.body),
    requestLocale(req),
  );
  res.status(201).json(data);
}

async function list(req, res) {
  const invitations = await invitationService.listCalendarInvitations(req.authUser._id, validateCalendarId(req.params.id));
  res.status(200).json({ invitations });
}

async function createBulk(req, res) {
  const data = await invitationService.createBulkCalendarInvitations(
    req.authUser._id,
    validateCalendarId(req.params.id),
    validateCalendarInvitationBulkCreate(req.body),
    requestLocale(req),
  );
  res.status(202).json(data);
}

async function revoke(req, res) {
  await invitationService.revokeCalendarInvitation(
    req.authUser._id,
    validateCalendarId(req.params.id),
    validateObjectId(req.params.invitationId, 'calendar invitation ID'),
  );
  res.status(204).end();
}

async function remember(req, res) {
  await invitationService.rememberCalendarInvitation(req, res, validateCalendarInvitationToken(req.body).token);
  res.status(204).end();
}

async function claim(req, res) {
  const calendar = await invitationService.claimPendingCalendarInvitation(req, res, req.authUser);
  if (!calendar) {
    res.status(204).end();
    return;
  }
  res.status(200).json({ calendar });
}

module.exports = { claim, create, createBulk, list, remember, revoke };
