const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto');
const config = require('../config/config');

const PREFIX_LENGTH = 12;
const SECRET_LENGTH = 43;

function getHashSecret() {
  if (!config.security.apiKeyHashSecret) {
    throw new Error('API_KEY_HASH_SECRET must be configured before API keys can be used');
  }
  return config.security.apiKeyHashSecret;
}

function hashApiKeySecret(secret) {
  return createHmac('sha256', getHashSecret()).update(secret).digest('hex');
}

function createRawApiKey() {
  const prefix = `ck_${randomBytes(9).toString('base64url')}`;
  const secret = randomBytes(32).toString('base64url');
  return {
    prefix,
    secretHash: hashApiKeySecret(secret),
    rawKey: `${prefix}.${secret}`,
  };
}

function parseRawApiKey(value) {
  if (typeof value !== 'string') return null;
  const match = new RegExp(`^(ck_[A-Za-z0-9_-]{${PREFIX_LENGTH}})\\.([A-Za-z0-9_-]{${SECRET_LENGTH}})$`).exec(value);
  if (!match) return null;
  return { prefix: match[1], secret: match[2] };
}

function matchesApiKeySecret(secret, storedHash) {
  if (typeof storedHash !== 'string' || !/^[a-f0-9]{64}$/.test(storedHash)) return false;
  const expected = Buffer.from(hashApiKeySecret(secret), 'hex');
  const actual = Buffer.from(storedHash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

module.exports = {
  createRawApiKey,
  hashApiKeySecret,
  matchesApiKeySecret,
  parseRawApiKey,
};
