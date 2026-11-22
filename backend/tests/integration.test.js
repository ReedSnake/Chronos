const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { readFileSync } = require('node:fs');
const Integration = require('../src/models/Integration');
const ApiKey = require('../src/models/ApiKey');
const {
  validateApiKeyCreate,
  validateIntegrationCreate,
  validateIntegrationUpdate,
} = require('../src/validators/integrationValidators');

function loadWithMocks(relativePath, replacements) {
  const filename = path.resolve(__dirname, relativePath);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const prior = Module._load;
  Module._load = function mocked(request, parent, isMain) {
    if (parent?.filename === filename && Object.hasOwn(replacements, request)) return replacements[request];
    return prior.call(this, request, parent, isMain);
  };
  try { loaded._compile(readFileSync(filename, 'utf8'), filename); }
  finally { Module._load = prior; }
  return loaded.exports;
}

test('integration and API-key models constrain ownership, status and secret storage', async () => {
  const integration = new Integration({ ownerUserId: '0123456789abcdef01234567', name: ' Zoom plugin ' });
  await integration.validate();
  assert.equal(integration.name, 'Zoom plugin');
  assert.equal(integration.status, 'active');

  const key = new ApiKey({
    integrationId: integration._id,
    ownerUserId: integration.ownerUserId,
    label: 'Production',
    prefix: 'ck_abcdefghijkl',
    secretHash: 'ab'.repeat(32),
    scopes: ['calendar:read', 'calendar:write'],
  });
  await key.validate();
  assert.equal(key.secretHash, 'ab'.repeat(32));
  await assert.rejects(() => new ApiKey({
    integrationId: integration._id,
    ownerUserId: integration.ownerUserId,
    label: 'Bad',
    prefix: 'ck_abcdefghijkl',
    secretHash: 'ab'.repeat(32),
    scopes: ['calendar:read', 'calendar:read'],
  }).validate());
});

test('integration validation only accepts explicit names, statuses, labels and scopes', () => {
  assert.deepEqual(validateIntegrationCreate({ name: ' GitHub action ' }), { name: 'GitHub action' });
  assert.deepEqual(validateIntegrationUpdate({ name: 'New name', status: 'disabled' }), { name: 'New name', status: 'disabled' });
  assert.deepEqual(validateApiKeyCreate({ label: 'Production', scopes: ['calendar:read'] }), {
    label: 'Production', scopes: ['calendar:read'],
  });
  assert.deepEqual(validateApiKeyCreate({ label: 'Production', scopes: ['calendar:delete'] }), {
    label: 'Production', scopes: ['calendar:read', 'calendar:write', 'calendar:delete'],
  });
  for (const body of [
    {}, { name: '' }, { name: 'Okay', ownerUserId: 'x' }, { status: 'active' },
  ]) {
    assert.throws(() => validateIntegrationCreate(body), (error) => error.statusCode === 400);
  }
  for (const body of [
    {}, { label: 'Key', scopes: [] }, { label: 'Key', scopes: ['*'] },
    { label: 'Key', scopes: ['calendar:read', 'calendar:read'] }, { label: 'Key', scopes: ['calendar:read'], status: 'active' },
  ]) {
    assert.throws(() => validateApiKeyCreate(body), (error) => error.statusCode === 400);
  }
});

test('generated API keys have a lookup prefix and an HMAC hash but never expose the stored hash', () => {
  const apiKey = loadWithMocks('../src/utils/apiKey.js', {
    '../config/config': { security: { apiKeyHashSecret: 'test-only-secret' } },
  });
  const generated = apiKey.createRawApiKey();
  const parsed = apiKey.parseRawApiKey(generated.rawKey);
  assert.match(generated.rawKey, /^ck_[A-Za-z0-9_-]{12}\.[A-Za-z0-9_-]{43}$/);
  assert.equal(parsed.prefix, generated.prefix);
  assert.ok(apiKey.matchesApiKeySecret(parsed.secret, generated.secretHash));
  assert.equal(apiKey.matchesApiKeySecret('x'.repeat(43), generated.secretHash), false);
});

test('API-key creation returns a raw key once while listing metadata has no secret hash', async () => {
  const keyRecord = {
    _id: 'fedcba987654321001234567', label: 'Production', prefix: 'ck_abcdefghijkl',
    scopes: ['calendar:write'], status: 'active', lastUsedAt: null, revokedAt: null, createdAt: null,
  };
  let saved;
  const service = loadWithMocks('../src/services/integrationService.js', {
    '../models/Integration': { findOne: async () => ({ _id: 'aaaaaaaaaaaaaaaaaaaaaaaa' }) },
    '../models/ApiKey': { create: async (value) => { saved = value; return keyRecord; } },
    '../utils/apiKey': { createRawApiKey: () => ({
      prefix: 'ck_abcdefghijkl', secretHash: 'ab'.repeat(32), rawKey: 'ck_abcdefghijkl.secret-returned-once',
    }) },
  });
  const result = await service.createApiKey('0123456789abcdef01234567', 'aaaaaaaaaaaaaaaaaaaaaaaa', {
    label: 'Production', scopes: ['calendar:write'],
  });
  assert.equal(result.apiKey, 'ck_abcdefghijkl.secret-returned-once');
  assert.equal(saved.secretHash, 'ab'.repeat(32));
  assert.equal(Object.hasOwn(result.key, 'secretHash'), false);
});

test('API-key middleware applies hierarchical scope access before setting the principal', async () => {
  const calls = [];
  const middlewareModule = loadWithMocks('../src/middlewares/requireApiKey.js', {
    '../models/ApiKey': {
      findOne: () => ({ select: async () => ({
        _id: 'key-id', ownerUserId: 'user-id', integrationId: 'integration-id',
        secretHash: 'ab'.repeat(32), status: 'active', scopes: ['calendar:write'],
      }) }),
      updateOne: async (...args) => { calls.push(args); },
    },
    '../models/Integration': { findOne: async () => ({ _id: 'integration-id', status: 'active' }) },
    '../utils/apiKey': {
      parseRawApiKey: () => ({ prefix: 'ck_abcdefghijkl', secret: 'supplied-secret' }),
      matchesApiKeySecret: () => true,
    },
  });
  const req = { get: (name) => (name === 'authorization' ? 'Bearer raw-key' : undefined) };
  await new Promise((resolve, reject) => middlewareModule.requireApiKey('calendar:read')(
    req,
    {},
    (error) => (error ? reject(error) : resolve()),
  ));
  assert.deepEqual(req.apiPrincipal, {
    userId: 'user-id', integrationId: 'integration-id', apiKeyId: 'key-id',
    scopes: ['calendar:write'], authType: 'api-key',
  });
  assert.equal(calls.length, 1);
});
