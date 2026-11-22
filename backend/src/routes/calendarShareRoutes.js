const { Router } = require('express');
const controller = require('../controllers/calendarShareController');
const eventController = require('../controllers/eventController');
const requireAuth = require('../middlewares/requireAuth');
const { requireCalendarShareLink } = require('../middlewares/requireCalendarShareLink');
const authOrigin = require('../middlewares/authOrigin');
const asyncHandler = require('../utils/asyncHandler');

const managementRouter = Router();
managementRouter.get('/:id/share-links', requireAuth, asyncHandler(controller.list));
managementRouter.post('/:id/share-links', authOrigin, requireAuth, asyncHandler(controller.create));
managementRouter.delete('/:id/share-links/:linkId', authOrigin, requireAuth, asyncHandler(controller.revoke));

const sharedCalendarRouter = Router();
sharedCalendarRouter.get('/events', requireCalendarShareLink('viewer'), asyncHandler(eventController.listShared));
sharedCalendarRouter.get('/', requireCalendarShareLink('viewer'), asyncHandler(controller.getSharedCalendar));
sharedCalendarRouter.patch('/', authOrigin, requireCalendarShareLink('editor'), asyncHandler(controller.updateSharedCalendar));
sharedCalendarRouter.delete('/', authOrigin, requireCalendarShareLink('admin'), asyncHandler(controller.deleteSharedCalendar));

module.exports = { managementRouter, sharedCalendarRouter };
