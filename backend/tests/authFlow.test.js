const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const Module = require('node:module');
const path = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');

// Compile one module with mocked boundaries: unit tests run without live SMTP or MongoDB.
function loadWithMocks(relativePath, replacements) {
  const filename = path.resolve(__dirname, relativePath);
  const loadedModule = new Module(filename, module);
  loadedModule.filename = filename;
  loadedModule.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalLoad = Module._load;
  Module._load = function mockedLoad(request, parent, isMain) {
    if (parent?.filename === filename && Object.hasOwn(replacements, request)) return replacements[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    loadedModule._compile(readFileSync(filename, 'utf8'), filename);
  } finally {
    Module._load = originalLoad;
  }
  return loadedModule.exports;
}

test('registration stores verification hash, bcrypt hash and only reports success after SMTP', async () => {
  let created;
  let sent;
  let ready = true;
  const User = {
    exists: async () => false,
    create: async (body) => { created = body; },
  };
  const mail = {
    ensureMailConfigured: () => { if (!ready) throw new Error('Email delivery is not configured'); },
    sendVerificationEmail: async (email, token) => { sent = { email, token }; },
  };
  const service = loadWithMocks('../src/services/authService.js', {
    './personalCalendarService': { ensureMainCalendar: async () => {} },
    bcryptjs: { hash: async () => 'bcrypt-hash' },
    '../models/User': User,
    '../config/logger': { warn: () => {} },
    '../config/mail': mail,
    './sessionService': { hashToken: (v) => createHash('sha256').update(v).digest('hex') },
  });
  await service.register({ name: 'Jane', email: 'jane@example.com', password: 'my-long-password' });
  assert.equal(created.passwordHash, 'bcrypt-hash');
  assert.equal(created.country, undefined);
  assert.equal(created.emailVerifiedAt, null);
  assert.equal(created.emailVerification.tokenHash,
    createHash('sha256').update(sent.token).digest('hex'));
  assert.notEqual(created.emailVerification.tokenHash, sent.token);
  assert.match(sent.token, /^[a-f0-9]{64}$/);
  assert.equal(sent.email, 'jane@example.com');
  ready = false;
  await assert.rejects(() => service.register({ name: 'Jane', email: 'jane@example.com', password: 'x' }));
});

test('SMTP failures surface HTTP 503 and never pretend delivery succeeded', async () => {
  const service = loadWithMocks('../src/services/authService.js', {
    './personalCalendarService': { ensureMainCalendar: async () => {} },
    bcryptjs: { hash: async () => 'bcrypt-hash' },
    '../models/User': { exists: async () => false, create: async () => {} },
    '../config/logger': { warn: () => {} },
    '../config/mail': {
      ensureMailConfigured: () => {},
      sendVerificationEmail: async () => { const error = new Error('private smtp details'); error.code = 'ESOCKET'; throw error; },
    },
    './sessionService': { hashToken: (v) => createHash('sha256').update(v).digest('hex') },
  });
  await assert.rejects(() => service.register({ name: 'Jane', email: 'jane@example.com', password: 'secure password' }),
    (error) => error.statusCode === 503 && !error.message.includes('private'));
});

test('verification consumes a hashed token and creates a session only after atomic update', async () => {
  const seen = [];
  const verifiedUser = { _id: 'sampleid', name: 'Jane', email: 'jane@example.com', country: 'XX', emailVerifiedAt: new Date() };
  const service = loadWithMocks('../src/services/authService.js', {
    './personalCalendarService': { ensureMainCalendar: async () => {} },
    bcryptjs: {},
    '../models/User': { findOneAndUpdate: async (...args) => { seen.push(args); return verifiedUser; } },
    '../config/logger': { warn: () => {} },
    '../config/mail': {},
    './sessionService': {
      hashToken: (v) => createHash('sha256').update(v).digest('hex'),
      createSession: async (userId) => { seen.push(userId); },
    },
  });
  const token = 'fe'.repeat(32);
  const result = await service.verifyEmail({ token }, {}, {});
  assert.equal(result.user.emailVerified, true);
  assert.equal(seen[0][0]['emailVerification.tokenHash'], createHash('sha256').update(token).digest('hex'));
  assert.ok(seen[0][0]['emailVerification.expiresAt'].$gt instanceof Date);
  assert.deepEqual(seen[0][1].$unset, { emailVerification: '' });
  assert.equal(seen[1], verifiedUser._id);
});

test('session tokens are HttpOnly, hashed at rest, checked for expiry, and revoked on logout', async () => {
  let created;
  let revoked;
  let lookup;
  let cookie;
  let cleared;
  const AuthSession = {
    create: async (data) => { created = data; },
    findOne: async (query) => { lookup = query; return { userId: 'user-id' }; },
    deleteOne: async (query) => { revoked = query; },
  };
  const service = loadWithMocks('../src/services/sessionService.js', {
    '../models/AuthSession': AuthSession,
    '../models/User': { findOne: async () => ({ name: 'Jane' }) },
    '../config/config': { auth: { secureCookies: false } },
  });
  const req = { secure: false, headers: {} };
  const res = {
    cookie: (name, token, opts) => { cookie = { name, token, opts }; },
    clearCookie: (name, opts) => { cleared = { name, opts }; },
  };
  await service.createSession('user-id', req, res);
  assert.match(cookie.token, /^[a-f0-9]{64}$/);
  assert.equal(cookie.opts.httpOnly, true);
  assert.equal(cookie.opts.sameSite, 'lax');
  assert.equal(created.tokenHash, service.hashToken(cookie.token));
  assert.notEqual(created.tokenHash, cookie.token);
  req.headers.cookie = `chronos_session=${cookie.token}`;
  await service.findAuthenticatedUser(req);
  assert.equal(lookup.tokenHash, created.tokenHash);
  assert.ok(lookup.expiresAt.$gt instanceof Date);
  await service.revokeSession(req, res);
  assert.equal(revoked.tokenHash, created.tokenHash);
  assert.equal(cleared.name, 'chronos_session');
});

test('Gmail SMTP uses TLS 465 and sends a fragment-based one-time link', async () => {
  let transportOptions;
  let emailMessage;
  const mail = loadWithMocks('../src/config/mail.js', {
    nodemailer: {
      createTransport: (options) => {
        transportOptions = options;
        return { sendMail: async (message) => { emailMessage = message; } };
      },
    },
    './config': {
      mail: { user: 'sender@gmail.com', appPassword: 'local-test-value', frontendUrl: 'http://localhost:5173' },
    },
  });
  const token = 'ab'.repeat(32);
  await mail.sendVerificationEmail('jane@example.com', token);
  assert.equal(transportOptions.host, 'smtp.gmail.com');
  assert.equal(transportOptions.port, 465);
  assert.equal(transportOptions.secure, true);
  assert.equal(transportOptions.auth.user, 'sender@gmail.com');
  assert.ok(emailMessage.text.includes(`/verify-email#token=${token}`));
  assert.ok(!emailMessage.text.includes('?token='));

  await mail.sendVerificationEmail('jane@example.com', token, 'uk');
  assert.equal(emailMessage.subject, 'Підтвердьте email у Chronos');
  await mail.sendIntegrationPairingEmail('jane@example.com', {
    token,
    integrationName: 'Calendar Bot',
    scopes: ['calendar:read'],
  }, 'uk');
  assert.ok(emailMessage.text.includes('читання календарів'));
  await mail.sendCalendarInvitationEmail('jane@example.com', {
    token,
    calendarName: 'Team',
    role: 'editor',
  }, 'uk');
  assert.ok(emailMessage.text.includes('редагування'));
});

test('login refuses unverified users and does not create a session', async () => {
  let sessions = 0;
  const service = loadWithMocks('../src/services/authService.js', {
    './personalCalendarService': { ensureMainCalendar: async () => {} },
    bcryptjs: { compare: async () => true },
    '../models/User': { findOne: () => ({ select: async () => ({ passwordHash: 'bcrypt-hash', emailVerifiedAt: null }) }) },
    '../config/logger': { warn: () => {} },
    '../config/mail': {},
    './sessionService': { createSession: async () => { sessions++; } },
  });
  await assert.rejects(() => service.login({ email: 'jane@example.com', password: 'password' }, {}, {}),
    (error) => error.statusCode === 403);
  assert.equal(sessions, 0);
});

test('expired or already consumed verification link never creates a session', async () => {
  let sessions = 0;
  const service = loadWithMocks('../src/services/authService.js', {
    './personalCalendarService': { ensureMainCalendar: async () => {} },
    bcryptjs: {},
    '../models/User': { findOneAndUpdate: async () => null },
    '../config/logger': { warn: () => {} },
    '../config/mail': {},
    './sessionService': {
      hashToken: (v) => createHash('sha256').update(v).digest('hex'),
      createSession: async () => { sessions++; },
    },
  });
  await assert.rejects(() => service.verifyEmail({ token: 'cd'.repeat(32) }, {}, {}),
    (error) => error.statusCode === 400);
  assert.equal(sessions, 0);
});
