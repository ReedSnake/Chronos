const { Router } = require('express');
const authOrigin = require('../middlewares/authOrigin');
const authRateLimit = require('../middlewares/authRateLimit');
const requireAuth = require('../middlewares/requireAuth');
const asyncHandler = require('../utils/asyncHandler');
const { requestLocale } = require('../utils/requestLocale');
const { validateCalendarId } = require('../validators/calendarValidators');
const { validateEventId } = require('../validators/eventValidators');
const service = require('../services/eventInvitationService');
const AppError = require('../utils/AppError');

function requireFields(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== fields.length || !fields.every((key) => Object.hasOwn(body, key))) {
    throw new AppError('Invalid invitation request', 400, 'VALIDATION_ERROR');
  }
}

const managementRouter = Router();
managementRouter.post('/:id/events/:eventId/invitations', authOrigin, requireAuth, authRateLimit({ limit: 50 }), asyncHandler(async (req, res) => {
  requireFields(req.body, ['email']);
  res.status(200).json(await service.sendInvitation(req.authUser._id, validateCalendarId(req.params.id), validateEventId(req.params.eventId), req.body?.email, requestLocale(req)));
}));
const publicRouter = Router();
publicRouter.use(authOrigin, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
publicRouter.post('/preview', authRateLimit({ limit: 60 }), asyncHandler(async (req, res) => {
  requireFields(req.body, ['token']);
  res.json({ event: await service.previewInvitation(req.body?.token) });
}));
publicRouter.post('/respond', authRateLimit({ limit: 30 }), asyncHandler(async (req, res) => {
  requireFields(req.body, ['token', 'response']);
  res.json(await service.respondInvitation(req.body?.token, req.body?.response));
}));
module.exports = { managementRouter, publicRouter };
