const { Router } = require('express');
const controller = require('../controllers/integrationAccessController');
const requireAuth = require('../middlewares/requireAuth');
const authOrigin = require('../middlewares/authOrigin');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.get('/integration-requests', requireAuth, asyncHandler(controller.listMyPairingRequests));
router.post('/integration-requests/resolve', authOrigin, requireAuth, asyncHandler(controller.resolveMyPairingRequest));
router.post('/integration-requests/:id/approve', authOrigin, requireAuth, asyncHandler(controller.approveMyPairingRequest));
router.post('/integration-requests/:id/reject', authOrigin, requireAuth, asyncHandler(controller.rejectMyPairingRequest));
router.get('/integration-grants', requireAuth, asyncHandler(controller.listMyGrants));
router.delete('/integration-grants/:id', authOrigin, requireAuth, asyncHandler(controller.revokeMyGrant));

module.exports = router;
