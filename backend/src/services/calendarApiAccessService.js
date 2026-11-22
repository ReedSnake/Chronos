const { requireActiveIntegrationGrant } = require('./integrationAccessService');
const { validateTargetUserId } = require('../validators/calendarValidators');

async function resolveApiTarget(apiPrincipal, requestedTargetUserId, scope) {
  const ownerUserId = String(apiPrincipal.userId);
  const targetUserId = requestedTargetUserId === undefined
    ? ownerUserId
    : validateTargetUserId(requestedTargetUserId);

  if (String(targetUserId) !== ownerUserId) {
    await requireActiveIntegrationGrant(apiPrincipal.integrationId, targetUserId, scope);
  }
  return targetUserId;
}

async function getApiTarget(req, scope) {
  if (!req.apiPrincipal) return null;
  return resolveApiTarget(req.apiPrincipal, req.query?.targetUserId, scope);
}

module.exports = { getApiTarget, resolveApiTarget };
