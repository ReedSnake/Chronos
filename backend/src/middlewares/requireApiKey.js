const ApiKey = require('../models/ApiKey');
const Integration = require('../models/Integration');
const AppError = require('../utils/AppError');
const { hasScope } = require('../constants/apiScopes');
const { matchesApiKeySecret, parseRawApiKey } = require('../utils/apiKey');

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_KEYS = 5000;
const rateBuckets = new Map();

function unauthorized() {
  return new AppError('API key authentication required', 401, 'API_KEY_UNAUTHORIZED');
}

function readBearerKey(req) {
  const authorization = req.get('authorization');
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
  return parseRawApiKey(authorization.slice('Bearer '.length));
}

function enforceRateLimit(req, res, prefix, limit) {
  const now = Date.now();
  if (rateBuckets.size > RATE_LIMIT_MAX_KEYS) {
    for (const [key, record] of rateBuckets) {
      if (record.resetAt <= now) rateBuckets.delete(key);
    }
  }
  const key = `${prefix}:${req.ip || 'unknown'}`;
  if (!rateBuckets.has(key) && rateBuckets.size >= RATE_LIMIT_MAX_KEYS) {
    throw new AppError('Too many requests. Try again later.', 429, 'RATE_LIMITED');
  }
  const previous = rateBuckets.get(key);
  const record = !previous || previous.resetAt <= now
    ? { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS }
    : previous;
  record.count += 1;
  rateBuckets.set(key, record);
  if (record.count > limit) {
    res.setHeader('Retry-After', String(Math.ceil((record.resetAt - now) / 1000)));
    throw new AppError('Too many requests. Try again later.', 429, 'RATE_LIMITED');
  }
}

function requireApiKey(requiredScope, { limit = 120 } = {}) {
  return async (req, res, next) => {
    try {
      const supplied = readBearerKey(req);
      if (!supplied) throw unauthorized();
      enforceRateLimit(req, res, supplied.prefix, limit);

      const key = await ApiKey.findOne({ prefix: supplied.prefix }).select('+secretHash');
      if (!key || !matchesApiKeySecret(supplied.secret, key.secretHash) || key.status !== 'active') {
        throw unauthorized();
      }
      if (requiredScope && !hasScope(key.scopes, requiredScope)) {
        throw new AppError('API key does not have the required scope', 403, 'API_KEY_SCOPE_FORBIDDEN');
      }
      const integration = await Integration.findOne({ _id: key.integrationId, status: 'active' });
      if (!integration) throw unauthorized();

      await ApiKey.updateOne({ _id: key._id, status: 'active' }, { $set: { lastUsedAt: new Date() } });
      req.apiPrincipal = {
        userId: key.ownerUserId,
        integrationId: key.integrationId,
        apiKeyId: key._id,
        scopes: key.scopes,
        authType: 'api-key',
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { requireApiKey };
