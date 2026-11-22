const integrationAccessService = require('../services/integrationAccessService');
const {
  validateObjectId,
  validatePairingCreate,
  validatePairingToken,
} = require('../validators/integrationValidators');
const { requestLocale } = require('../utils/requestLocale');

async function createPairingRequest(req, res) {
  const data = await integrationAccessService.createPairingRequest(
    req.apiPrincipal,
    validatePairingCreate(req.body),
    requestLocale(req),
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

async function listMyPairingRequests(req, res) {
  const requests = await integrationAccessService.listPendingPairingRequests(req.authUser);
  res.status(200).json({ requests });
}

async function resolveMyPairingRequest(req, res) {
  const request = await integrationAccessService.resolvePairingRequest(
    req.authUser,
    validatePairingToken(req.body).token,
  );
  res.status(200).json({ request });
}

async function approveMyPairingRequest(req, res) {
  const grant = await integrationAccessService.approvePairingRequest(
    req.authUser,
    validateObjectId(req.params.id, 'pairing request ID'),
  );
  res.status(200).json({ grant });
}

async function rejectMyPairingRequest(req, res) {
  await integrationAccessService.rejectPairingRequest(
    req.authUser,
    validateObjectId(req.params.id, 'pairing request ID'),
  );
  res.status(204).end();
}

async function listMyGrants(req, res) {
  const grants = await integrationAccessService.listActiveGrants(req.authUser._id);
  res.status(200).json({ grants });
}

async function revokeMyGrant(req, res) {
  await integrationAccessService.revokeGrant(
    req.authUser._id,
    validateObjectId(req.params.id, 'integration grant ID'),
  );
  res.status(204).end();
}

module.exports = {
  approveMyPairingRequest,
  createPairingRequest,
  getPairingRequest,
  listMyGrants,
  listMyPairingRequests,
  rejectMyPairingRequest,
  resolveMyPairingRequest,
  revokeMyGrant,
};
