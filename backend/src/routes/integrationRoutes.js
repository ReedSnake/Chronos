const { Router } = require('express');
const integrationController = require('../controllers/integrationController');
const pairingController = require('../controllers/integrationAccessController');
const requireAuth = require('../middlewares/requireAuth');
const { requireApiKey } = require('../middlewares/requireApiKey');
const authOrigin = require('../middlewares/authOrigin');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.post('/me/pairing-requests', requireApiKey(undefined, { limit: 10 }), asyncHandler(pairingController.createPairingRequest));
router.get('/me/pairing-requests/:id', requireApiKey(), asyncHandler(pairingController.getPairingRequest));
router.get('/', requireAuth, asyncHandler(integrationController.listIntegrations));
router.post('/', authOrigin, requireAuth, asyncHandler(integrationController.createIntegration));
router.patch('/:id', authOrigin, requireAuth, asyncHandler(integrationController.updateIntegration));
router.post('/:id/keys', authOrigin, requireAuth, asyncHandler(integrationController.createApiKey));
router.get('/:id/keys', requireAuth, asyncHandler(integrationController.listApiKeys));
router.delete('/:id/keys/:keyId', authOrigin, requireAuth, asyncHandler(integrationController.revokeApiKey));

module.exports = router;
