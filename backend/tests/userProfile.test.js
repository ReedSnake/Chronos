const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { readFileSync } = require('node:fs');
const { validateProfile, validateCountry, validateSettings, validateUserId } = require('../src/validators/userValidators');

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

test('profile validation only accepts profile fields and safe values', () => {
  assert.deepEqual(validateProfile({ name: '  Maya  ', bio: '  hi  ' }), { name: 'Maya', bio: 'hi' });
  assert.deepEqual(validateProfile({ bio: '' }), { bio: '' });
  for (const body of [{}, { name: ' ' }, { bio: 'x'.repeat(501) }, { email: 'attacker@test.com' }, { settings: {} }, { $set: { email: 'a' } }]) {
    assert.throws(() => validateProfile(body), (e) => e.statusCode === 400);
  }
});

test('country, settings and user ID validation rejects invalid values and fields', () => {
  assert.deepEqual(validateCountry({ country: ' ua ' }), { country: 'UA' });
  assert.deepEqual(validateCountry({ country: null }), { country: null });
  assert.throws(() => validateCountry({ country: 'Ukraine' }));
  assert.throws(() => validateCountry({ country: 'UA', role: 'admin' }));
  assert.deepEqual(validateSettings({ language: 'uk', timeZone: 'Europe/Kyiv', weekStartsOn: 'monday' }), {
    'settings.language': 'uk', 'settings.timeZone': 'Europe/Kyiv', 'settings.weekStartsOn': 'monday',
  });
  assert.throws(() => validateSettings({ timeZone: 'not-a-time-zone' }));
  assert.throws(() => validateSettings({ emailNotifications: true }));
  assert.throws(() => validateSettings({ timeFormat: '13h' }));
  assert.equal(validateUserId('0123456789abcdef01234567'), '0123456789abcdef01234567');
  assert.throws(() => validateUserId('$ne'));
});

test('own profile includes email/settings but limited profile never includes them', () => {
  const service = loadWithMocks('../src/services/userService.js', {
    '../models/User': {}, '../models/Avatar': {}, '../models/AuthSession': {}, './sessionService': {},
  });
  const user = { _id: '0123456789abcdef01234567', name: 'Maya', bio: 'Hello', email: 'maya@example.test',
    country: 'UA', emailVerifiedAt: new Date(), avatarUpdatedAt: new Date('2026-01-01'),
    settings: { language: 'uk' }, createdAt: new Date('2025-01-01') };
  const own = service.ownProfile(user);
  assert.equal(own.email, 'maya@example.test');
  assert.equal(own.settings.language, 'uk');
  assert.equal(own.settings.weekStartsOn, 'monday');
  assert.match(own.avatarUrl, /users\/0123456789abcdef01234567\/avatar\?v=/);
  const limited = service.limitedProfile(user);
  assert.deepEqual(Object.keys(limited), ['id', 'name', 'bio', 'country', 'avatarUrl', 'createdAt']);
  assert.equal(limited.name, own.name);
});

test('updates whitelist $set fields, country null unsets, and nonexistent public profiles return 404', async () => {
  const calls = [];
  const user = { _id: '0123456789abcdef01234567', name: 'Maya', email: 'm@example.test' };
  const service = loadWithMocks('../src/services/userService.js', {
    '../models/User': {
      findByIdAndUpdate: async (...args) => { calls.push(args); return user; },
      findById: async () => null,
    },
    '../models/Avatar': {}, '../models/AuthSession': {}, './sessionService': {},
  });
  await service.updateProfile(user._id, validateProfile({ name: ' Hello ' }));
  assert.deepEqual(calls[0][1], { $set: { name: 'Hello' } });
  assert.equal(calls[0][2].runValidators, true);
  await service.updateCountry(user._id, validateCountry({ country: null }));
  assert.deepEqual(calls[1][1], { $unset: { country: '' } });
  await assert.rejects(() => service.getPublicProfile('0123456789abcdef01234567'), (e) => e.statusCode === 404);
});

test('image service rejects unsupported, oversized and spoofed images', async () => {
  let saved;
  const service = loadWithMocks('../src/services/userService.js', {
    '../models/User': { findByIdAndUpdate: async () => ({ _id: '0123456789abcdef01234567', name: 'Maya', email: 'm@example.test' }) },
    '../models/Avatar': { findOneAndUpdate: async (...args) => { saved = args; } },
    '../models/AuthSession': {}, './sessionService': {},
  });
  const uid = '0123456789abcdef01234567';
  await assert.rejects(() => service.setAvatar(uid, Buffer.from('evil'), 'image/png'), (e) => e.statusCode === 400);
  await assert.rejects(() => service.setAvatar(uid, Buffer.from('png'), 'text/plain'), (e) => e.statusCode === 415);
  await assert.rejects(() => service.setAvatar(uid, Buffer.alloc(2 * 1024 * 1024 + 1), 'image/jpeg'), (e) => e.statusCode === 400);
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
  await service.setAvatar(uid, png, 'image/png');
  assert.equal(saved[0].userId, uid);
  assert.equal(saved[1].$set.contentType, 'image/png');
});

test('account deletion revokes sessions and removes avatar before deleting the user', async () => {
  const userId = '0123456789abcdef01234567';
  const calls = [];
  const req = { headers: {} };
  const res = {};
  const service = loadWithMocks('../src/services/userService.js', {
    '../models/User': {
      exists: async (filter) => { assert.deepEqual(filter, { _id: userId }); calls.push('exists'); return { _id: userId }; },
      deleteOne: async (filter) => { assert.deepEqual(filter, { _id: userId }); calls.push('user'); return { deletedCount: 1 }; },
    },
    '../models/Avatar': {
      deleteOne: async (filter) => { assert.deepEqual(filter, { userId }); calls.push('avatar'); },
    },
    '../models/AuthSession': {
      deleteMany: async (filter) => { assert.deepEqual(filter, { userId }); calls.push('sessions'); },
    },
    './sessionService': {
      revokeSession: async (request, response) => {
        assert.equal(request, req);
        assert.equal(response, res);
        calls.push('cookie');
      },
    },
  });
  await service.deleteAccount(userId, req, res);
  assert.deepEqual(calls, ['exists', 'cookie', 'sessions', 'avatar', 'user']);
});

test('account deletion returns 404 without clearing data when the user no longer exists', async () => {
  const calls = [];
  const service = loadWithMocks('../src/services/userService.js', {
    '../models/User': {
      exists: async () => null,
      deleteOne: async () => { calls.push('user'); },
    },
    '../models/Avatar': { deleteOne: async () => { calls.push('avatar'); } },
    '../models/AuthSession': { deleteMany: async () => { calls.push('sessions'); } },
    './sessionService': { revokeSession: async () => { calls.push('cookie'); } },
  });
  await assert.rejects(() => service.deleteAccount('0123456789abcdef01234567', {}, {}),
    (error) => error.statusCode === 404 && error.code === 'USER_NOT_FOUND');
  assert.deepEqual(calls, []);
});

test('account deletion keeps the user when session revocation fails', async () => {
  const calls = [];
  const failure = new Error('Session store unavailable');
  const service = loadWithMocks('../src/services/userService.js', {
    '../models/User': {
      exists: async () => ({ _id: '0123456789abcdef01234567' }),
      deleteOne: async () => { calls.push('user'); },
    },
    '../models/Avatar': { deleteOne: async () => { calls.push('avatar'); } },
    '../models/AuthSession': { deleteMany: async () => { calls.push('sessions'); } },
    './sessionService': { revokeSession: async () => { calls.push('cookie'); throw failure; } },
  });
  await assert.rejects(() => service.deleteAccount('0123456789abcdef01234567', {}, {}), failure);
  assert.deepEqual(calls, ['cookie']);
});

test('account deletion keeps the user when related-data cleanup fails', async () => {
  const userId = '0123456789abcdef01234567';
  for (const failingStep of ['sessions', 'avatar']) {
    const calls = [];
    const failure = new Error(`${failingStep} cleanup failed`);
    const service = loadWithMocks('../src/services/userService.js', {
      '../models/User': {
        exists: async () => ({ _id: userId }),
        deleteOne: async () => { calls.push('user'); return { deletedCount: 1 }; },
      },
      '../models/Avatar': {
        deleteOne: async () => { calls.push('avatar'); if (failingStep === 'avatar') throw failure; },
      },
      '../models/AuthSession': {
        deleteMany: async () => { calls.push('sessions'); if (failingStep === 'sessions') throw failure; },
      },
      './sessionService': { revokeSession: async () => { calls.push('cookie'); } },
    });
    await assert.rejects(() => service.deleteAccount(userId, {}, {}), failure);
    assert.deepEqual(calls, failingStep === 'sessions'
      ? ['cookie', 'sessions']
      : ['cookie', 'sessions', 'avatar']);
  }
});

test('account deletion can be retried after a temporary avatar cleanup failure', async () => {
  const userId = '0123456789abcdef01234567';
  let attempt = 0;
  let deleted = 0;
  const service = loadWithMocks('../src/services/userService.js', {
    '../models/User': {
      exists: async () => ({ _id: userId }),
      deleteOne: async () => { deleted++; return { deletedCount: 1 }; },
    },
    '../models/Avatar': {
      deleteOne: async () => { if (++attempt === 1) throw new Error('Temporary database error'); },
    },
    '../models/AuthSession': { deleteMany: async () => {} },
    './sessionService': { revokeSession: async () => {} },
  });
  await assert.rejects(() => service.deleteAccount(userId, {}, {}), /Temporary database error/);
  assert.equal(deleted, 0);
  await service.deleteAccount(userId, {}, {});
  assert.equal(attempt, 2);
  assert.equal(deleted, 1);
});

test('account deletion reports a race when the final user deletion finds no account', async () => {
  const userId = '0123456789abcdef01234567';
  const service = loadWithMocks('../src/services/userService.js', {
    '../models/User': {
      exists: async () => ({ _id: userId }),
      deleteOne: async () => ({ deletedCount: 0 }),
    },
    '../models/Avatar': { deleteOne: async () => {} },
    '../models/AuthSession': { deleteMany: async () => {} },
    './sessionService': { revokeSession: async () => {} },
  });
  await assert.rejects(() => service.deleteAccount(userId, {}, {}),
    (error) => error.statusCode === 404 && error.code === 'USER_NOT_FOUND');
});
