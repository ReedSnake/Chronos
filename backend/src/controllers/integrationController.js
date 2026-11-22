const integrationService = require('../services/integrationService');
const {
  validateIntegrationCreate,
  validateIntegrationUpdate,
  validateApiKeyCreate,
  validateObjectId,
  validatePairingCreate,
} = require('../validators/integrationValidators');
const integrationAccessService = require('../services/integrationAccessService');

async function createIntegration(req, res) {
  const integration = await integrationService.createIntegration(req.authUser._id, validateIntegrationCreate(req.body));
  res.status(201).json({ integration });
}

async function listIntegrations(req, res) {
  res.status(200).json({ integrations: await integrationService.listIntegrations(req.authUser._id) });
}

async function updateIntegration(req, res) {
  const integration = await integrationService.updateIntegration(
    req.authUser._id,
    validateObjectId(req.params.id, 'integration ID'),
    validateIntegrationUpdate(req.body),
  );
  res.status(200).json({ integration });
}

async function createApiKey(req, res) {
  const data = await integrationService.createApiKey(
    req.authUser._id,
    validateObjectId(req.params.id, 'integration ID'),
    validateApiKeyCreate(req.body),
  );
  res.status(201).json(data);
}

async function listApiKeys(req, res) {
  const keys = await integrationService.listApiKeys(
    req.authUser._id,
    validateObjectId(req.params.id, 'integration ID'),
  );
  res.status(200).json({ keys });
}

async function revokeApiKey(req, res) {
  await integrationService.revokeApiKey(
    req.authUser._id,
    validateObjectId(req.params.id, 'integration ID'),
    validateObjectId(req.params.keyId, 'API key ID'),
  );
  res.status(204).end();
}

async function createPairingRequest(req, res) {
  const data = await integrationAccessService.createPairingRequest(
    req.apiPrincipal,
    validatePairingCreate(req.body),
  );
  res.status(202).json(data);
}

async function getPairingRequest(req, res) {
  const request = await integrationAccessService.getPairingRequestForIntegration(
    req.apiPrincipal,
    validateObjectId(req.params.id, 'pairing request ID'),
  );
  res.status(200).json({ request });
}

module.exports = {
  createIntegration,
  listIntegrations,
  updateIntegration,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  createPairingRequest,
  getPairingRequest,
};
