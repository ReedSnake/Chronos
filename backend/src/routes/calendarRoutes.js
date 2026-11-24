const { Router } = require('express');
const calendarController = require('../controllers/calendarController');
const eventController = require('../controllers/eventController');
const {
  requireCalendarCreateAccess,
  requireCalendarDeleteAccess,
  requireCalendarReadAccess,
  requireCalendarWriteAccess,
} = require('../middlewares/requireCalendarCreateAccess');
const authOrigin = require('../middlewares/authOrigin');
const asyncHandler = require('../utils/asyncHandler');
const { managementRouter } = require('./calendarShareRoutes');
const { managementRouter: invitationManagementRouter } = require('./calendarInvitationRoutes');
const { managementRouter: memberManagementRouter } = require('./calendarMemberRoutes');

const router = Router();

router.get('/', requireCalendarReadAccess, asyncHandler(calendarController.list));
router.post('/', authOrigin, requireCalendarCreateAccess, asyncHandler(calendarController.create));
router.use('/', managementRouter);
router.use('/', invitationManagementRouter);
router.use('/', memberManagementRouter);
router.get('/:id/events', requireCalendarReadAccess, asyncHandler(eventController.list));
router.post('/:id/events', authOrigin, requireCalendarWriteAccess, asyncHandler(eventController.create));
router.get('/:id/events/:eventId', requireCalendarReadAccess, asyncHandler(eventController.get));
router.patch('/:id/events/:eventId', authOrigin, requireCalendarWriteAccess, asyncHandler(eventController.update));
router.delete('/:id/events/:eventId', authOrigin, requireCalendarWriteAccess, asyncHandler(eventController.remove));
router.get('/:id', requireCalendarReadAccess, asyncHandler(calendarController.get));
router.patch('/:id', authOrigin, requireCalendarWriteAccess, asyncHandler(calendarController.update));
router.delete('/:id', authOrigin, requireCalendarDeleteAccess, asyncHandler(calendarController.remove));

module.exports = router;
