const { Router } = require('express');
const controller = require('../controllers/calendarMemberController');
const requireAuth = require('../middlewares/requireAuth');
const authOrigin = require('../middlewares/authOrigin');
const asyncHandler = require('../utils/asyncHandler');

const managementRouter = Router();

managementRouter.get('/:id/members', requireAuth, asyncHandler(controller.list));
managementRouter.post('/:id/members', authOrigin, requireAuth, asyncHandler(controller.create));
managementRouter.patch('/:id/members/:memberId', authOrigin, requireAuth, asyncHandler(controller.update));
managementRouter.delete('/:id/members/:memberId', authOrigin, requireAuth, asyncHandler(controller.remove));

module.exports = { managementRouter };
