const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { readFileSync } = require('node:fs');
const CalendarInvitation = require('../src/models/CalendarInvitation');
const {
  validateCalendarInvitationBulkCreate,
  validateCalendarInvitationCreate,
  validateCalendarInvitationToken,
} = require('../src/validators/calendarValidators');

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

test('calendar invitations protect email-targeted tokens and validate invite input', async () => {
  const invitation = new CalendarInvitation({
    calendarId: '0123456789abcdef01234567', invitedByUserId: 'fedcba987654321001234567',
    email: 'PERSON@example.test', role: 'editor', prefix: 'ci_abcdefghijkl',
    tokenHash: 'ab'.repeat(32), expiresAt: new Date(Date.now() + 60000),
  });
  await invitation.validate();
  assert.equal(invitation.email, 'person@example.test');
  assert.deepEqual(validateCalendarInvitationCreate({
    email: ' Person@example.test ', role: 'viewer', expiresInMinutes: 60,
  }), { email: 'person@example.test', role: 'viewer', expiresInMinutes: 60 });
  assert.deepEqual(validateCalendarInvitationBulkCreate({
    emails: [' One@example.test ', 'two@example.test', 'one@example.test'], role: 'editor', expiresInMinutes: 60,
  }), {
    emails: ['one@example.test', 'two@example.test', 'one@example.test'], role: 'editor', expiresInMinutes: 60,
  });
  assert.deepEqual(validateCalendarInvitationToken({ token: 'ci_abcdefghijkl.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }), {
    token: 'ci_abcdefghijkl.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  });
  assert.throws(() => validateCalendarInvitationCreate({ email: 'invalid', role: 'viewer', expiresInMinutes: 60 }));
  assert.throws(() => validateCalendarInvitationCreate({ email: 'user@example.test', role: 'viewer', expiresInMinutes: null }));
  assert.throws(() => validateCalendarInvitationBulkCreate({ emails: [], role: 'viewer', expiresInMinutes: 60 }));
  assert.throws(() => validateCalendarInvitationToken({ token: 'bad' }));
});

test('bulk invitations deduplicate recipients and report every delivery result', async () => {
  let sent = 0;
  let nextId = 0;
  const service = loadWithMocks('../src/services/calendarInvitationService.js', {
    '../config/config': { auth: { secureCookies: false }, mail: { frontendUrl: 'https://chronos.example.test' } },
    '../models/Calendar': {},
    '../models/User': { findOne: () => ({ select: async () => null }) },
    '../models/CalendarMember': { exists: async () => false },
    '../models/CalendarInvitation': {
      exists: async () => false,
      create: async (value) => ({ _id: `invite-${nextId += 1}`, ...value, status: 'pending', createdAt: null }),
      deleteOne: async () => {},
      updateMany: async () => {},
    },
    '../config/mail': {
      ensureMailConfigured: () => {},
      sendCalendarInvitationEmail: async () => { sent += 1; },
    },
    './emailDeliveryQueue': { enqueueEmailDelivery: async (deliver) => deliver() },
    '../utils/calendarInvitation': {
      createCalendarInvitationToken: () => ({ prefix: 'ci_abcdefghijkl', tokenHash: 'ab'.repeat(32), rawToken: 'ci_abcdefghijkl.token' }),
      parseCalendarInvitationToken: () => null,
      matchesCalendarInvitationToken: () => false,
    },
    './calendarService': { getUserCalendarAccess: async () => ({ calendar: { name: 'Team calendar' } }) },
  });
  const result = await service.createBulkCalendarInvitations('owner-id', 'calendar-id', {
    emails: ['one@example.test', 'one@example.test', 'two@example.test'],
    role: 'viewer',
    expiresInMinutes: 60,
  });
  assert.deepEqual(result.results.map((item) => item.status), ['sent', 'duplicate', 'sent']);
  assert.equal(sent, 2);
});

test('a single invitation does not duplicate an active invitation', async () => {
  const service = loadWithMocks('../src/services/calendarInvitationService.js', {
    '../config/config': { auth: { secureCookies: false }, mail: { frontendUrl: 'https://chronos.example.test' } },
    '../models/Calendar': {},
    '../models/User': { findOne: () => ({ select: async () => null }) },
    '../models/CalendarMember': { exists: async () => false },
    '../models/CalendarInvitation': {
      updateMany: async () => {},
      exists: async () => true,
    },
    '../config/mail': { ensureMailConfigured: () => {} },
    './emailDeliveryQueue': {},
    '../utils/calendarInvitation': {},
    './calendarService': { getUserCalendarAccess: async () => ({ calendar: { name: 'Team calendar' } }) },
  });
  await assert.rejects(
    service.createCalendarInvitation('owner-id', 'calendar-id', {
      email: 'member@example.test', role: 'viewer', expiresInMinutes: 60,
    }),
    (error) => error.statusCode === 409 && error.code === 'CALENDAR_INVITATION_ALREADY_PENDING',
  );
});

test('remembered invitation only creates membership for the invited email and clears its cookie', async () => {
  let claimed;
  let updated;
  let cleared;
  const service = loadWithMocks('../src/services/calendarInvitationService.js', {
    '../config/config': { auth: { secureCookies: false }, mail: { frontendUrl: 'https://chronos.example.test' } },
    '../models/Calendar': { findById: async () => ({ _id: 'calendar-id' }) },
    '../models/CalendarInvitation': {
      findOne: () => ({ select: async () => ({
        _id: 'invite-id', calendarId: 'calendar-id', invitedByUserId: 'owner-id', email: 'invitee@example.test',
        role: 'editor', status: 'pending', expiresAt: new Date(Date.now() + 60000), tokenHash: 'ab'.repeat(32),
      }) }),
      updateOne: async (...args) => { updated = args; },
    },
    '../utils/calendarInvitation': {
      createCalendarInvitationToken: () => ({}),
      parseCalendarInvitationToken: () => ({ prefix: 'ci_abcdefghijkl', token: 'token' }),
      matchesCalendarInvitationToken: () => true,
    },
    '../config/mail': {},
    './calendarService': {
      getUserCalendarAccess: async () => ({}),
      claimCalendarMembership: async (userId, link) => { claimed = { userId, link }; return { id: 'calendar-id', role: 'editor' }; },
    },
  });
  const result = await service.claimPendingCalendarInvitation(
    { headers: { cookie: 'chronos_pending_calendar_invitation=ci_abcdefghijkl.token' }, secure: false },
    { clearCookie: (...args) => { cleared = args; } },
    { _id: 'invitee-id', email: 'invitee@example.test' },
  );
  assert.equal(result.id, 'calendar-id');
  assert.equal(claimed.userId, 'invitee-id');
  assert.equal(claimed.link.role, 'editor');
  assert.equal(updated[1].$set.status, 'accepted');
  assert.equal(cleared[0], 'chronos_pending_calendar_invitation');
});

test('a wrong-email invitation never creates membership', async () => {
  let claimed = false;
  const service = loadWithMocks('../src/services/calendarInvitationService.js', {
    '../config/config': { auth: { secureCookies: false }, mail: { frontendUrl: 'https://chronos.example.test' } },
    '../models/Calendar': {},
    '../models/CalendarInvitation': {
      findOne: () => ({ select: async () => ({
        _id: 'invite-id', email: 'other@example.test', status: 'pending', expiresAt: new Date(Date.now() + 60000), tokenHash: 'ab'.repeat(32),
      }) }),
    },
    '../utils/calendarInvitation': {
      createCalendarInvitationToken: () => ({}),
      parseCalendarInvitationToken: () => ({ prefix: 'ci_abcdefghijkl', token: 'token' }),
      matchesCalendarInvitationToken: () => true,
    },
    '../config/mail': {},
    './calendarService': { getUserCalendarAccess: async () => ({}), claimCalendarMembership: async () => { claimed = true; } },
  });
  const result = await service.claimPendingCalendarInvitation(
    { headers: { cookie: 'chronos_pending_calendar_invitation=ci_abcdefghijkl.token' }, secure: false },
    { clearCookie: () => {} },
    { _id: 'different-user', email: 'different@example.test' },
  );
  assert.equal(result, null);
  assert.equal(claimed, false);
});
