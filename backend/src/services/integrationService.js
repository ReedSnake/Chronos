const Integration = require('../models/Integration');
const ApiKey = require('../models/ApiKey');
const AppError = require('../utils/AppError');
const { createRawApiKey } = require('../utils/apiKey');

function integrationResponse(integration) {
  return {
    id: String(integration._id),
    name: integration.name,
    status: integration.status,
    createdAt: integration.createdAt || null,
    updatedAt: integration.updatedAt || null,
  };
}

function apiKeyResponse(key) {
  return {
    id: String(key._id),
    label: key.label,
    prefix: key.prefix,
    scopes: key.scopes,
    status: key.status,
    lastUsedAt: key.lastUsedAt || null,
    revokedAt: key.revokedAt || null,
    createdAt: key.createdAt || null,
  };
}

async function findOwnedIntegration(ownerUserId, integrationId) {
  const integration = await Integration.findOne({ _id: integrationId, ownerUserId });
  if (!integration) throw new AppError('Integration not found', 404, 'INTEGRATION_NOT_FOUND');
  return integration;
}

async function createIntegration(ownerUserId, values) {
  return integrationResponse(await Integration.create({ ownerUserId, ...values }));
}

async function listIntegrations(ownerUserId) {
  const integrations = await Integration.find({ ownerUserId }).sort({ createdAt: -1, _id: -1 });
  return integrations.map(integrationResponse);
}

async function updateIntegration(ownerUserId, integrationId, values) {
  const integration = await Integration.findOneAndUpdate(
    { _id: integrationId, ownerUserId },
    { $set: values },
    { new: true, runValidators: true },
  );
  if (!integration) throw new AppError('Integration not found', 404, 'INTEGRATION_NOT_FOUND');
  return integrationResponse(integration);
}

async function createApiKey(ownerUserId, integrationId, values) {
  await findOwnedIntegration(ownerUserId, integrationId);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const generated = createRawApiKey();
    try {
      const key = await ApiKey.create({
        integrationId,
        ownerUserId,
        label: values.label,
        scopes: values.scopes,
        prefix: generated.prefix,
        secretHash: generated.secretHash,
      });
      return { apiKey: generated.rawKey, key: apiKeyResponse(key) };
    } catch (error) {
      if (error?.code !== 11000 || attempt === 2) throw error;
    }
  }
  throw new AppError('Unable to create API key', 503, 'API_KEY_CREATION_FAILED');
}

async function listApiKeys(ownerUserId, integrationId) {
  await findOwnedIntegration(ownerUserId, integrationId);
  const keys = await ApiKey.find({ integrationId, ownerUserId }).sort({ createdAt: -1, _id: -1 });
  return keys.map(apiKeyResponse);
}

async function revokeApiKey(ownerUserId, integrationId, keyId) {
  const key = await ApiKey.findOneAndUpdate({
    _id: keyId,
    integrationId,
    ownerUserId,
  }, {
    $set: { status: 'revoked', revokedAt: new Date() },
  }, { new: true });
  if (!key) throw new AppError('API key not found', 404, 'API_KEY_NOT_FOUND');
}

module.exports = {
  createIntegration,
  listIntegrations,
  updateIntegration,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  integrationResponse,
  apiKeyResponse,
};
