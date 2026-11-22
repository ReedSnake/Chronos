const { Router } = require('express');
const controller = require('../controllers/calendarInvitationController');
const requireAuth = require('../middlewares/requireAuth');
const authOrigin = require('../middlewares/authOrigin');
const asyncHandler = require('../utils/asyncHandler');

const managementRouter = Router();
managementRouter.get('/:id/invitations', requireAuth, asyncHandler(controller.list));
managementRouter.post('/:id/invitations', authOrigin, requireAuth, asyncHandler(controller.create));
managementRouter.post('/:id/invitations/bulk', authOrigin, requireAuth, asyncHandler(controller.createBulk));
managementRouter.delete('/:id/invitations/:invitationId', authOrigin, requireAuth, asyncHandler(controller.revoke));

const publicRouter = Router();
publicRouter.post('/remember', authOrigin, asyncHandler(controller.remember));
publicRouter.post('/claim', authOrigin, requireAuth, asyncHandler(controller.claim));

module.exports = { managementRouter, publicRouter };
