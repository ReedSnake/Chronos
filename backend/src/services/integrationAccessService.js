const { randomBytes } = require('node:crypto');
const User = require('../models/User');
const Integration = require('../models/Integration');
const IntegrationAccessGrant = require('../models/IntegrationAccessGrant');
const PairingRequest = require('../models/PairingRequest');
const AppError = require('../utils/AppError');
const { hasScope, normalizeScopes, scopesThatPermit } = require('../constants/apiScopes');
const { ensureMailConfigured, sendIntegrationPairingEmail } = require('../config/mail');
const { hashToken } = require('./sessionService');

const PAIRING_DURATION_MS = 30 * 60 * 1000;
const PAIRING_NEUTRAL_RESPONSE = Object.freeze({
  messageCode: 'PAIRING_REQUEST_SENT',
});

function grantResponse(grant, integration) {
  return {
    id: String(grant._id),
    scopes: grant.scopes,
    status: grant.status,
    requestedAt: grant.requestedAt,
    grantedAt: grant.grantedAt || null,
    revokedAt: grant.revokedAt || null,
    integration: {
      id: String(integration?._id || grant.integrationId),
      name: integration?.name || null,
      status: integration?.status || null,
    },
  };
}

function pairingRequestResponse(request) {
  const integration = request.integrationId;
  return {
    id: String(request._id),
    scopes: request.scopes,
    status: request.status,
    expiresAt: request.expiresAt,
    requestedAt: request.createdAt,
    integration: {
      id: String(integration?._id || integration),
      name: integration?.name || null,
      status: integration?.status || null,
    },
  };
}

async function preparePendingGrant(integrationId, userId, scopes) {
  const normalizedScopes = normalizeScopes(scopes);
  const now = new Date();
  const existing = await IntegrationAccessGrant.findOne({ integrationId, userId });
  if (existing?.status === 'active') return null;

  if (existing) {
    return IntegrationAccessGrant.findOneAndUpdate({
      _id: existing._id,
      status: { $ne: 'active' },
    }, {
      $set: {
        scopes: normalizedScopes,
        status: 'pending',
        requestedAt: now,
        grantedAt: null,
        revokedAt: null,
      },
    }, { new: true, runValidators: true });
  }

  try {
    return await IntegrationAccessGrant.create({
      integrationId,
      userId,
      scopes: normalizedScopes,
      status: 'pending',
      requestedAt: now,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return preparePendingGrant(integrationId, userId, scopes);
  }
}

async function createPairingRequest(apiPrincipal, { email, scopes }, locale = 'en') {
  const normalizedScopes = normalizeScopes(scopes);
  if (normalizedScopes.some((scope) => !hasScope(apiPrincipal.scopes, scope))) {
    throw new AppError('Requested scopes exceed this API key permissions', 403, 'PAIRING_SCOPE_FORBIDDEN');
  }

  // Configuration errors apply equally to all requests and therefore do not reveal users by email.
  ensureMailConfigured();
  const [targetUser, integration] = await Promise.all([
    User.findOne({ email }),
    Integration.findOne({ _id: apiPrincipal.integrationId, status: 'active' }),
  ]);
  if (!integration) return PAIRING_NEUTRAL_RESPONSE;

  const targetIsVerified = Boolean(targetUser?.emailVerifiedAt);
  const grant = targetIsVerified
    ? await preparePendingGrant(integration._id, targetUser._id, normalizedScopes)
    : null;
  if (targetIsVerified && !grant) return PAIRING_NEUTRAL_RESPONSE;

  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const now = new Date();
  await PairingRequest.updateMany({
    integrationId: integration._id,
    targetEmail: email,
    status: 'pending',
  }, { $set: { status: 'superseded', resolvedAt: now } });

  const request = await PairingRequest.create({
    integrationId: integration._id,
    grantId: grant?._id || null,
    targetUserId: targetUser?._id || null,
    targetEmail: email,
    requestedByApiKeyId: apiPrincipal.apiKeyId,
    scopes: normalizedScopes,
    tokenHash,
    expiresAt: new Date(now.getTime() + PAIRING_DURATION_MS),
  });

  try {
    await sendIntegrationPairingEmail(email, {
      token,
      integrationName: integration.name,
      scopes: normalizedScopes,
    }, locale);
  } catch (error) {
    await PairingRequest.deleteOne({ _id: request._id, tokenHash });
    if (grant) {
      await IntegrationAccessGrant.updateOne(
        { _id: grant._id, status: 'pending' },
        { $set: { status: 'revoked', revokedAt: new Date() } },
      );
    }
    throw error;
  }
  return PAIRING_NEUTRAL_RESPONSE;
}

async function getPairingRequestForIntegration(apiPrincipal, requestId) {
  const request = await PairingRequest.findOne({
    _id: requestId,
    integrationId: apiPrincipal.integrationId,
  });
  if (!request) throw new AppError('Pairing request not found', 404, 'PAIRING_REQUEST_NOT_FOUND');
  return {
    id: String(request._id),
    status: request.status,
    scopes: request.scopes,
    requestedAt: request.createdAt,
    expiresAt: request.expiresAt,
    ...(request.status === 'approved' ? { userId: String(request.targetUserId) } : {}),
  };
}

async function bindPendingPairingRequestsForUser(user) {
  await PairingRequest.updateMany({
    targetUserId: null,
    targetEmail: user.email,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }, { $set: { targetUserId: user._id } });
}

async function listPendingPairingRequests(user) {
  await bindPendingPairingRequestsForUser(user);
  const requests = await PairingRequest.find({
    targetUserId: user._id,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).populate('integrationId', 'name status').sort({ createdAt: -1, _id: -1 });
  return requests.map(pairingRequestResponse);
}

async function resolvePairingRequest(user, token) {
  await bindPendingPairingRequestsForUser(user);
  const request = await PairingRequest.findOne({
    targetUserId: user._id,
    tokenHash: hashToken(token),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).populate('integrationId', 'name status');
  if (!request) throw new AppError('Pairing link is invalid or has expired', 400, 'INVALID_PAIRING_TOKEN');
  return pairingRequestResponse(request);
}

async function approvePairingRequest(user, requestId) {
  await bindPendingPairingRequestsForUser(user);
  const request = await PairingRequest.findOne({
    _id: requestId,
    targetUserId: user._id,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });
  if (!request) throw new AppError('Pairing request is invalid or has expired', 400, 'INVALID_PAIRING_REQUEST');

  const integration = await Integration.findOne({ _id: request.integrationId, status: 'active' });
  if (!integration) throw new AppError('Integration is no longer available', 400, 'INTEGRATION_UNAVAILABLE');

  let grantId = request.grantId;
  if (!grantId) {
    const pendingGrant = await preparePendingGrant(integration._id, user._id, request.scopes);
    if (pendingGrant) {
      grantId = pendingGrant._id;
      await PairingRequest.updateOne({ _id: request._id, status: 'pending' }, { $set: { grantId } });
    } else {
      const activeGrant = await IntegrationAccessGrant.findOne({
        integrationId: integration._id,
        userId: user._id,
        status: 'active',
      });
      if (!activeGrant) throw new AppError('Pairing request is no longer available', 400, 'INVALID_PAIRING_REQUEST');
      await PairingRequest.updateOne(
        { _id: request._id, status: 'pending' },
        { $set: { grantId: activeGrant._id, status: 'approved', resolvedAt: new Date() } },
      );
      return grantResponse(activeGrant, integration);
    }
  }

  const grant = await IntegrationAccessGrant.findOneAndUpdate({
    _id: grantId,
    userId: user._id,
    status: 'pending',
  }, {
    $set: { status: 'active', grantedAt: new Date(), revokedAt: null },
  }, { new: true });
  if (!grant) throw new AppError('Pairing request is no longer available', 400, 'INVALID_PAIRING_REQUEST');

  await PairingRequest.updateOne(
    { _id: request._id, status: 'pending' },
    { $set: { status: 'approved', resolvedAt: new Date() } },
  );
  return grantResponse(grant, integration);
}

async function rejectPairingRequest(user, requestId) {
  await bindPendingPairingRequestsForUser(user);
  const request = await PairingRequest.findOne({
    _id: requestId,
    targetUserId: user._id,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });
  if (!request) throw new AppError('Pairing request is invalid or has expired', 400, 'INVALID_PAIRING_REQUEST');

  if (request.grantId) {
    await IntegrationAccessGrant.updateOne(
      { _id: request.grantId, userId: user._id, status: 'pending' },
      { $set: { status: 'revoked', revokedAt: new Date() } },
    );
  }
  await PairingRequest.updateOne(
    { _id: request._id, status: 'pending' },
    { $set: { status: 'rejected', resolvedAt: new Date() } },
  );
}

async function listActiveGrants(userId) {
  const grants = await IntegrationAccessGrant.find({ userId, status: 'active' })
    .populate('integrationId', 'name status')
    .sort({ grantedAt: -1, _id: -1 });
  return grants.map((grant) => grantResponse(grant, grant.integrationId));
}

async function revokeGrant(userId, grantId) {
  const grant = await IntegrationAccessGrant.findOneAndUpdate({
    _id: grantId,
    userId,
    status: { $in: ['pending', 'active'] },
  }, {
    $set: { status: 'revoked', revokedAt: new Date() },
  }, { new: true });
  if (!grant) throw new AppError('Integration grant not found', 404, 'INTEGRATION_GRANT_NOT_FOUND');
  await PairingRequest.updateMany(
    { grantId: grant._id, status: 'pending' },
    { $set: { status: 'cancelled', resolvedAt: new Date() } },
  );
}

async function requireActiveIntegrationGrant(integrationId, userId, scope) {
  const grant = await IntegrationAccessGrant.exists({
    integrationId,
    userId,
    status: 'active',
    scopes: { $in: scopesThatPermit(scope) },
  });
  if (!grant) {
    // Do not distinguish an unknown user from a user who did not grant access.
    throw new AppError('Calendar not found', 404, 'CALENDAR_NOT_FOUND');
  }
}

module.exports = {
  approvePairingRequest,
  bindPendingPairingRequestsForUser,
  createPairingRequest,
  getPairingRequestForIntegration,
  listActiveGrants,
  listPendingPairingRequests,
  rejectPairingRequest,
  requireActiveIntegrationGrant,
  resolvePairingRequest,
  revokeGrant,
};
