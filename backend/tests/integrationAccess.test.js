const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { readFileSync } = require('node:fs');
const IntegrationAccessGrant = require('../src/models/IntegrationAccessGrant');
const PairingRequest = require('../src/models/PairingRequest');

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

test('access-grant and pairing-request models constrain scope, ownership, status and expiry', async () => {
  const grant = new IntegrationAccessGrant({
    integrationId: '0123456789abcdef01234567', userId: 'fedcba987654321001234567', scopes: ['calendar:write'],
  });
  await grant.validate();
  assert.equal(grant.status, 'pending');
  const request = new PairingRequest({
    integrationId: grant.integrationId,
    grantId: grant._id,
    targetUserId: grant.userId,
    requestedByApiKeyId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    targetEmail: 'target@example.test',
    scopes: ['calendar:write'],
    tokenHash: 'ab'.repeat(32),
    expiresAt: new Date(Date.now() + 60000),
  });
  await request.validate();
  assert.ok(PairingRequest.schema.indexes().some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0));
});

test('API-key pairing sends an opaque approval token only when requested scopes are permitted', async () => {
  let sent;
  let createdRequest;
  const service = loadWithMocks('../src/services/integrationAccessService.js', {
    '../models/User': { findOne: async () => ({ _id: 'target-id', email: 'target@example.test' }) },
    '../models/Integration': { findOne: async () => ({ _id: 'integration-id', name: 'Calendar Bot', status: 'active' }) },
    '../models/IntegrationAccessGrant': {
      findOne: async () => null,
      create: async (value) => ({ _id: 'grant-id', ...value }),
      updateOne: async () => {},
    },
    '../models/PairingRequest': {
      updateMany: async () => {},
      create: async (value) => { createdRequest = value; return { _id: 'request-id', ...value }; },
      deleteOne: async () => {},
    },
    '../config/mail': {
      ensureMailConfigured: () => {},
      sendIntegrationPairingEmail: async (email, values) => { sent = { email, ...values }; },
    },
    './sessionService': { hashToken: (value) => `hash-${value}` },
  });
  const principal = { integrationId: 'integration-id', apiKeyId: 'key-id', scopes: ['calendar:delete'] };
  const result = await service.createPairingRequest(principal, {
    email: 'target@example.test', scopes: ['calendar:write'],
  });
  assert.equal(result.messageCode, 'PAIRING_REQUEST_SENT');
  assert.equal(sent.email, 'target@example.test');
  assert.match(sent.token, /^[a-f0-9]{64}$/);
  assert.equal(createdRequest.tokenHash, `hash-${sent.token}`);
  assert.deepEqual(createdRequest.scopes, ['calendar:read', 'calendar:write']);
  assert.equal(Object.hasOwn(result, 'token'), false);
  await assert.rejects(
    () => service.createPairingRequest({ ...principal, scopes: ['calendar:write'] }, { email: 'target@example.test', scopes: ['calendar:delete'] }),
    (error) => error.statusCode === 403,
  );
});

test('API-key pairing can email an unregistered user without granting access before approval', async () => {
  let createdRequest;
  let sent;
  const service = loadWithMocks('../src/services/integrationAccessService.js', {
    '../models/User': { findOne: async () => null },
    '../models/Integration': { findOne: async () => ({ _id: 'integration-id', name: 'Calendar Bot', status: 'active' }) },
    '../models/IntegrationAccessGrant': {},
    '../models/PairingRequest': {
      updateMany: async () => {},
      create: async (value) => { createdRequest = value; return { _id: 'request-id', ...value }; },
      deleteOne: async () => {},
    },
    '../config/mail': {
      ensureMailConfigured: () => {},
      sendIntegrationPairingEmail: async (email, values) => { sent = { email, ...values }; },
    },
    './sessionService': { hashToken: (value) => `hash-${value}` },
  });
  await service.createPairingRequest(
    { integrationId: 'integration-id', apiKeyId: 'key-id', scopes: ['calendar:write'] },
    { email: 'new-user@example.test', scopes: ['calendar:write'] },
  );
  assert.equal(sent.email, 'new-user@example.test');
  assert.equal(createdRequest.targetEmail, 'new-user@example.test');
  assert.equal(createdRequest.targetUserId, null);
  assert.equal(createdRequest.grantId, null);
});

test('approval activates only the target user grant and grant lookup hides unapproved users', async () => {
  let grantFilter;
  let requestUpdate;
  let existsFilter;
  const service = loadWithMocks('../src/services/integrationAccessService.js', {
    '../models/User': {},
    '../models/Integration': { findOne: async () => ({ _id: 'integration-id', name: 'Calendar Bot', status: 'active' }) },
    '../models/IntegrationAccessGrant': {
      findOneAndUpdate: async (filter) => {
        grantFilter = filter;
        return {
          _id: 'grant-id', integrationId: 'integration-id', userId: 'target-id', scopes: ['calendar:write'],
          status: 'active', requestedAt: new Date(), grantedAt: new Date(), revokedAt: null,
        };
      },
      exists: async (filter) => { existsFilter = filter; return null; },
    },
    '../models/PairingRequest': {
      findOne: async () => ({
        _id: 'request-id', integrationId: 'integration-id', grantId: 'grant-id', targetUserId: 'target-id',
      }),
      updateMany: async () => {},
      updateOne: async (...args) => { requestUpdate = args; },
    },
    '../config/mail': {},
    './sessionService': {},
  });
  const grant = await service.approvePairingRequest({ _id: 'target-id', email: 'target@example.test' }, 'request-id');
  assert.equal(grant.status, 'active');
  assert.deepEqual(grantFilter, { _id: 'grant-id', userId: 'target-id', status: 'pending' });
  assert.equal(requestUpdate[0]._id, 'request-id');
  await assert.rejects(
    () => service.requireActiveIntegrationGrant('integration-id', 'unknown-user', 'calendar:write'),
    (error) => error.statusCode === 404 && error.code === 'CALENDAR_NOT_FOUND',
  );
  assert.deepEqual(existsFilter.scopes, { $in: ['calendar:write', 'calendar:delete'] });
});

test('API-authenticated calendar creation can target another user only after a write grant', async () => {
  let granted;
  let created;
  const controller = loadWithMocks('../src/controllers/calendarController.js', {
    '../services/calendarService': { createCalendar: async (ownerUserId, values) => { created = { ownerUserId, values }; return { id: 'calendar-id' }; } },
    '../services/calendarApiAccessService': { resolveApiTarget: async (principal, targetUserId, scope) => { granted = [principal.integrationId, targetUserId, scope]; return targetUserId; } },
  });
  const req = {
    apiPrincipal: { userId: '0123456789abcdef01234567', integrationId: 'integration-id' },
    body: { name: 'Target calendar', targetUserId: 'fedcba987654321001234567' },
  };
  let response;
  await controller.create(req, { status: (status) => ({ json: (body) => { response = { status, body }; } }) });
  assert.deepEqual(granted, ['integration-id', 'fedcba987654321001234567', 'calendar:write']);
  assert.equal(created.ownerUserId, 'fedcba987654321001234567');
  assert.deepEqual(created.values, { name: 'Target calendar' });
  assert.equal(response.status, 201);
});

test('calendar API target resolution defaults to the integration owner and checks another user grant', async () => {
  let grantCheck;
  const access = loadWithMocks('../src/services/calendarApiAccessService.js', {
    './integrationAccessService': { requireActiveIntegrationGrant: async (...args) => { grantCheck = args; } },
  });
  const principal = { userId: '0123456789abcdef01234567', integrationId: 'integration-id' };
  assert.equal(await access.resolveApiTarget(principal, undefined, 'calendar:read'), principal.userId);
  assert.equal(grantCheck, undefined);
  assert.equal(
    await access.resolveApiTarget(principal, 'fedcba987654321001234567', 'calendar:read'),
    'fedcba987654321001234567',
  );
  assert.deepEqual(grantCheck, ['integration-id', 'fedcba987654321001234567', 'calendar:read']);
});

test('an API key can create a calendar for its integration owner without a grant', async () => {
  let grantCalled = false;
  let created;
  const controller = loadWithMocks('../src/controllers/calendarController.js', {
    '../services/calendarService': { createCalendar: async (ownerUserId, values) => { created = { ownerUserId, values }; return { id: 'calendar-id' }; } },
    '../services/calendarApiAccessService': { resolveApiTarget: async (principal, targetUserId) => { if (targetUserId !== undefined) grantCalled = true; return principal.userId; } },
  });
  await controller.create(
    { apiPrincipal: { integrationId: 'integration-id', userId: '0123456789abcdef01234567' }, body: { name: 'Owner calendar' } },
    { status: () => ({ json: () => {} }) },
  );
  assert.equal(grantCalled, false);
  assert.deepEqual(created, {
    ownerUserId: '0123456789abcdef01234567',
    values: { name: 'Owner calendar' },
  });
});

test('an API key defaults calendar reads to its integration owner without a grant', async () => {
  let listedForUserId;
  const controller = loadWithMocks('../src/controllers/calendarController.js', {
    '../services/calendarService': { listCalendars: async (userId) => { listedForUserId = userId; return []; } },
    '../services/calendarApiAccessService': { getApiTarget: async (req) => req.apiPrincipal.userId },
  });
  let response;
  await controller.list(
    { apiPrincipal: { integrationId: 'integration-id', userId: '0123456789abcdef01234567' }, query: {} },
    { status: (status) => ({ json: (body) => { response = { status, body }; } }) },
  );
  assert.equal(listedForUserId, '0123456789abcdef01234567');
  assert.deepEqual(response, { status: 200, body: { calendars: [] } });
});

test('a third-party Bearer API key reaches calendar creation with its approved target principal', async () => {
  const apiKeyMiddleware = loadWithMocks('../src/middlewares/requireApiKey.js', {
    '../models/ApiKey': {
      findOne: () => ({ select: async () => ({
        _id: 'key-id', ownerUserId: 'owner-id', integrationId: 'integration-id', status: 'active',
        secretHash: 'ab'.repeat(32), scopes: ['calendar:write'],
      }) }),
      updateOne: async () => {},
    },
    '../models/Integration': { findOne: async () => ({ _id: 'integration-id', status: 'active' }) },
    '../utils/apiKey': {
      parseRawApiKey: () => ({ prefix: 'ck_abcdefghijkl', secret: 'raw-secret' }),
      matchesApiKeySecret: () => true,
    },
  });
  let grantCheck;
  let created;
  const controller = loadWithMocks('../src/controllers/calendarController.js', {
    '../services/calendarService': { createCalendar: async (ownerUserId, values) => { created = { ownerUserId, values }; return { id: 'calendar-id' }; } },
    '../services/calendarApiAccessService': { resolveApiTarget: async (principal, targetUserId, scope) => { grantCheck = [principal.integrationId, targetUserId, scope]; return targetUserId; } },
  });
  const req = {
    ip: '127.0.0.1',
    get: (name) => (name === 'authorization' ? 'Bearer ck_abcdefghijkl.raw-secret' : undefined),
    body: { name: 'Created by a service', targetUserId: 'fedcba987654321001234567' },
  };
  let response;
  await new Promise((resolve, reject) => apiKeyMiddleware.requireApiKey('calendar:write')(
    req,
    { setHeader: () => {} },
    (error) => (error ? reject(error) : resolve()),
  ));
  await controller.create(req, { status: (status) => ({ json: (body) => { response = { status, body }; } }) });
  assert.deepEqual(grantCheck, ['integration-id', 'fedcba987654321001234567', 'calendar:write']);
  assert.deepEqual(created, { ownerUserId: 'fedcba987654321001234567', values: { name: 'Created by a service' } });
  assert.equal(response.status, 201);
});
