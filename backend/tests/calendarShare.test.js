const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { readFileSync } = require('node:fs');
const CalendarShareLink = require('../src/models/CalendarShareLink');
const { validateCalendarShareCreate, validateCalendarUpdate } = require('../src/validators/calendarValidators');

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

test('share-link model and validation constrain bearer access and expiry', async () => {
  const link = new CalendarShareLink({
    calendarId: '0123456789abcdef01234567', createdByUserId: 'fedcba987654321001234567',
    role: 'editor', prefix: 'cs_abcdefghijkl', tokenHash: 'ab'.repeat(32), expiresAt: new Date(Date.now() + 60000),
  });
  await link.validate();
  assert.equal(link.status, 'active');
  assert.deepEqual(validateCalendarShareCreate({ role: 'admin', expiresInMinutes: 60 }), { role: 'admin', expiresInMinutes: 60 });
  assert.deepEqual(validateCalendarUpdate({ name: '  Renamed  ', countryCode: null }), { name: 'Renamed', countryCode: null });
  for (const body of [
    { role: 'owner', expiresInMinutes: 60 }, { role: 'viewer', expiresInMinutes: 4 },
    { role: 'viewer', expiresInMinutes: 60, extra: true },
  ]) {
    assert.throws(() => validateCalendarShareCreate(body), (error) => error.statusCode === 400);
  }
});

test('calendar share tokens use a non-secret lookup prefix and constant-time HMAC match', () => {
  const tokenService = loadWithMocks('../src/utils/calendarShareLink.js', {
    '../config/config': { security: { calendarShareHashSecret: 'share-test-secret' } },
  });
  const generated = tokenService.createCalendarShareToken();
  const parsed = tokenService.parseCalendarShareToken(generated.rawToken);
  assert.match(generated.rawToken, /^cs_[A-Za-z0-9_-]{12}\.[A-Za-z0-9_-]{43}$/);
  assert.equal(parsed.prefix, generated.prefix);
  assert.equal(tokenService.matchesCalendarShareToken(parsed.token, generated.tokenHash), true);
  assert.equal(tokenService.matchesCalendarShareToken('x'.repeat(43), generated.tokenHash), false);
});

test('share-link creation returns its raw token only in a fragment URL', async () => {
  let stored;
  const service = loadWithMocks('../src/services/calendarShareService.js', {
    '../config/config': { mail: { frontendUrl: 'https://chronos.example.test/uk' } },
    '../models/CalendarShareLink': { create: async (data) => { stored = data; return { _id: 'link-id', ...data, status: 'active', createdAt: null, lastUsedAt: null, revokedAt: null }; } },
    '../utils/calendarShareLink': { createCalendarShareToken: () => ({
      prefix: 'cs_abcdefghijkl', tokenHash: 'ab'.repeat(32), rawToken: 'cs_abcdefghijkl.raw-token',
    }) },
    './calendarService': { getUserCalendarAccess: async () => ({ role: 'owner' }) },
  });
  const result = await service.createCalendarShareLink('user-id', 'calendar-id', { role: 'editor', expiresInMinutes: 60 });
  assert.equal(stored.tokenHash, 'ab'.repeat(32));
  assert.equal(Object.hasOwn(result.link, 'tokenHash'), false);
  assert.match(result.shareUrl, /\/calendar-share#token=cs_abcdefghijkl\.raw-token$/);
});

test('share-link middleware enforces the requested role and does not expose token hashes', async () => {
  let updated;
  const middleware = loadWithMocks('../src/middlewares/requireCalendarShareLink.js', {
    '../models/CalendarShareLink': {
      findOne: () => ({ select: async () => ({
        _id: 'link-id', calendarId: 'calendar-id', role: 'editor', status: 'active', expiresAt: new Date(Date.now() + 60000), tokenHash: 'ab'.repeat(32),
      }) }),
      updateOne: async (...args) => { updated = args; },
    },
    '../utils/calendarShareLink': {
      parseCalendarShareToken: () => ({ prefix: 'cs_abcdefghijkl', token: 'token' }),
      matchesCalendarShareToken: () => true,
    },
  });
  const req = { get: (name) => (name === 'authorization' ? 'CalendarLink raw-token' : undefined) };
  await new Promise((resolve, reject) => middleware.requireCalendarShareLink('editor')(
    req,
    {},
    (error) => (error ? reject(error) : resolve()),
  ));
  assert.equal(req.calendarShareLink.role, 'editor');
  assert.equal(updated[0]._id, 'link-id');
  await assert.rejects(() => new Promise((resolve, reject) => middleware.requireCalendarShareLink('admin')(
    { get: req.get },
    {},
    (error) => (error ? reject(error) : resolve()),
  )), (error) => error.statusCode === 403);
});

test('a public share link service never exposes membership-claim operations', () => {
  const service = loadWithMocks('../src/services/calendarShareService.js', {
    '../config/config': { mail: { frontendUrl: 'https://chronos.example.test' } },
    '../models/CalendarShareLink': {},
    '../utils/calendarShareLink': { createCalendarShareToken: () => ({}) },
    './calendarService': { getUserCalendarAccess: async () => ({}) },
  });
  assert.equal(Object.hasOwn(service, 'claimPendingCalendarShare'), false);
  assert.equal(Object.hasOwn(service, 'rememberPendingCalendarShare'), false);
});
