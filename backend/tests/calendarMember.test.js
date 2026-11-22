const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { readFileSync } = require('node:fs');
const {
  validateCalendarMemberCreate,
  validateCalendarMemberUpdate,
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

test('calendar member validation limits direct membership to an email and calendar role', () => {
  assert.deepEqual(validateCalendarMemberCreate({ email: ' Member@example.test ', role: 'editor' }), {
    email: 'member@example.test', role: 'editor',
  });
  assert.deepEqual(validateCalendarMemberUpdate({ role: 'viewer' }), { role: 'viewer' });
  assert.throws(() => validateCalendarMemberCreate({ email: 'member@example.test', role: 'owner' }));
  assert.throws(() => validateCalendarMemberUpdate({ role: 'owner' }));
});

test('an admin can add a verified existing user as a calendar member', async () => {
  let created;
  let revokedInvitation;
  const service = loadWithMocks('../src/services/calendarMemberService.js', {
    '../models/User': {
      findOne: () => ({ select: async () => ({ _id: 'member-id', name: 'Member', email: 'member@example.test' }) }),
    },
    '../models/CalendarMember': {
      findOne: async () => null,
      create: async (value) => { created = value; return { _id: 'membership-id', ...value, createdAt: null }; },
    },
    '../models/CalendarInvitation': { updateMany: async (...args) => { revokedInvitation = args; } },
    './calendarService': {
      getUserCalendarAccess: async () => ({ calendar: { ownerUserId: 'owner-id' } }),
    },
  });
  const member = await service.createCalendarMember('admin-id', 'calendar-id', {
    email: 'member@example.test', role: 'editor',
  });
  assert.deepEqual(created, {
    calendarId: 'calendar-id', userId: 'member-id', role: 'editor', addedByUserId: 'admin-id',
  });
  assert.equal(member.email, 'member@example.test');
  assert.equal(member.role, 'editor');
  assert.deepEqual(revokedInvitation[0], {
    calendarId: 'calendar-id', email: 'member@example.test', status: 'pending',
  });
});

test('an admin can update and remove a non-owner member', async () => {
  let deleted;
  const membership = { _id: 'membership-id', userId: 'member-id', role: 'viewer', calendarId: 'calendar-id' };
  const service = loadWithMocks('../src/services/calendarMemberService.js', {
    '../models/User': {
      findById: () => ({ select: async () => ({ _id: 'member-id', name: 'Member', email: 'member@example.test' }) }),
    },
    '../models/CalendarMember': {
      findOne: async () => membership,
      findByIdAndUpdate: async (_id, update) => ({ ...membership, role: update.$set.role }),
      deleteOne: async (filter) => { deleted = filter; },
    },
    '../models/CalendarInvitation': { updateMany: async () => {} },
    './calendarService': {
      getUserCalendarAccess: async () => ({ calendar: { ownerUserId: 'owner-id' } }),
    },
  });
  const updated = await service.updateCalendarMember('admin-id', 'calendar-id', 'membership-id', { role: 'admin' });
  await service.removeCalendarMember('admin-id', 'calendar-id', 'membership-id');
  assert.equal(updated.role, 'admin');
  assert.deepEqual(deleted, { _id: 'membership-id' });
});
