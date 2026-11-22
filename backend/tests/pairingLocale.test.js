const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { readFileSync } = require('node:fs');
const Module = require('node:module');

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

test('API-key pairing controller forwards Accept-Language to localized pairing mail service', async () => {
  const sent = [];
  const controller = loadWithMocks('../src/controllers/integrationAccessController.js', {
    '../services/integrationAccessService': {
      createPairingRequest: async (...args) => { sent.push(args); return { messageCode: 'PAIRING_REQUEST_SENT' }; },
    },
    '../validators/integrationValidators': {
      validatePairingCreate: (body) => body,
    },
  });
  for (const [language, expectedLocale] of [['uk-UA,uk;q=0.9', 'uk'], ['en-US', 'en']]) {
    let response;
    const req = {
      apiPrincipal: { integrationId: 'test-integration' },
      body: { email: 'a@example.test', scopes: ['calendar:read'] },
      headers: { 'accept-language': language },
    };
    await controller.createPairingRequest(req, {
      status: (status) => ({ json: (body) => { response = { status, body }; } }),
    });
    assert.equal(response.status, 202);
    assert.equal(sent.at(-1)[2], expectedLocale);
    assert.deepEqual(sent.at(-1)[1], req.body);
  }
});

test('integration CRUD controller no longer implements a second pairing handler', () => {
  const controller = loadWithMocks('../src/controllers/integrationController.js', {
    '../services/integrationService': {},
    '../validators/integrationValidators': {},
  });
  assert.equal(controller.createPairingRequest, undefined);
  assert.equal(controller.getPairingRequest, undefined);
  const routeSource = readFileSync(path.resolve(__dirname, '../src/routes/integrationRoutes.js'), 'utf8');
  assert.match(routeSource, /pairingController\.createPairingRequest/);
  assert.match(routeSource, /pairingController\.getPairingRequest/);
});
