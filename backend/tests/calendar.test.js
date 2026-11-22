const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { readFileSync } = require('node:fs');
const Calendar = require('../src/models/Calendar');
const CalendarMember = require('../src/models/CalendarMember');
const { CALENDAR_ROLE_CAPABILITIES, hasCalendarRole } = require('../src/constants/calendarRoles');
const {
  validateCalendarCreate,
  validateTargetUserId,
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

test('calendar role matrix is hierarchical and reserves management actions for admins', () => {
  assert.equal(hasCalendarRole('viewer', 'editor'), false);
  assert.equal(hasCalendarRole('editor', 'viewer'), true);
  assert.equal(hasCalendarRole('admin', 'editor'), true);
  assert.ok(CALENDAR_ROLE_CAPABILITIES.admin.includes('calendar:delete'));
  assert.ok(CALENDAR_ROLE_CAPABILITIES.admin.includes('calendar:share-links:manage'));
  assert.ok(CALENDAR_ROLE_CAPABILITIES.admin.includes('calendar:invitations:manage'));
  assert.ok(CALENDAR_ROLE_CAPABILITIES.admin.includes('calendar:members:manage'));
});

test('calendar models enforce ownership, constrained fields, and unique memberships', async () => {
  const calendar = new Calendar({
    ownerUserId: '0123456789abcdef01234567',
    name: '  Team calendar  ',
    color: '#abcdef',
    countryCode: 'ua',
    timeZone: 'Europe/Kyiv',
    defaultView: 'agenda',
    isArchived: true,
    defaultEventDurationMinutes: 90,
  });
  await calendar.validate();
  assert.equal(calendar.name, 'Team calendar');
  assert.equal(calendar.color, '#ABCDEF');
  assert.equal(calendar.countryCode, 'UA');
  assert.equal(calendar.timeZone, 'Europe/Kyiv');
  assert.equal(calendar.defaultView, 'agenda');
  assert.equal(calendar.isArchived, true);
  assert.equal(calendar.defaultEventDurationMinutes, 90);

  const member = new CalendarMember({
    calendarId: calendar._id,
    userId: 'fedcba987654321001234567',
    role: 'editor',
  });
  await member.validate();
  assert.ok(Calendar.schema.indexes().some(([keys, options]) => keys.ownerUserId === 1 && options.unique));
  assert.ok(CalendarMember.schema.indexes().some(([keys, options]) => keys.calendarId === 1 && keys.userId === 1 && options.unique));
});

test('calendar creation validation normalizes supported values and rejects unsafe fields', () => {
  assert.deepEqual(validateCalendarCreate({
    name: '  Work  ', description: '  Plans ', color: '#12abef', countryCode: ' ua ', isMain: true,
  }), {
    name: 'Work', description: 'Plans', color: '#12ABEF', countryCode: 'UA', isMain: true,
  });

  test('calendar API-key targetUserId validation accepts ObjectIds only', () => {
    assert.equal(validateTargetUserId('0123456789abcdef01234567'), '0123456789abcdef01234567');
    assert.throws(() => validateTargetUserId('not-an-object-id'), (error) => error.statusCode === 400);
  });
  assert.deepEqual(validateCalendarCreate({ name: 'Personal', countryCode: null }), {
    name: 'Personal', countryCode: null,
  });
  assert.deepEqual(validateCalendarCreate({
    name: 'Team', timeZone: 'Europe/Kyiv', defaultView: 'agenda', isArchived: false, defaultEventDurationMinutes: 45,
  }), {
    name: 'Team', timeZone: 'Europe/Kyiv', defaultView: 'agenda', isArchived: false, defaultEventDurationMinutes: 45,
  });
  for (const body of [
    {}, { name: '' }, { name: 'x'.repeat(121) }, { name: 'Ok', color: 'blue' },
    { name: 'Ok', countryCode: 'Ukraine' }, { name: 'Ok', isMain: 'true' }, { name: 'Ok', timeZone: 'Mars/Olympus' },
    { name: 'Ok', defaultView: 'week' }, { name: 'Ok', defaultEventDurationMinutes: 1 }, { name: 'Ok', ownerUserId: 'attacker' },
  ]) {
    assert.throws(() => validateCalendarCreate(body), (error) => error.statusCode === 400);
  }
});

test('calendar service assigns ownership and includes direct memberships in listings', async () => {
  const userId = '0123456789abcdef01234567';
  const sharedId = 'fedcba987654321001234567';
  let created;
  let findCalls = 0;
  const service = loadWithMocks('../src/services/calendarService.js', {
    '../models/Calendar': {
      create: async (data) => {
        created = data;
        return { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', ...data, createdAt: null, updatedAt: null };
      },
      find: () => ({
        sort: async () => {
          findCalls += 1;
          return findCalls === 1
            ? [{ _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Owned', description: '', color: '#3B82F6', isMain: false }]
            : [{ _id: sharedId, name: 'Shared', description: '', color: '#3B82F6', isMain: false }];
        },
      }),
    },
    '../models/CalendarMember': {
      find: () => ({ select: () => ({ lean: async () => [{ calendarId: sharedId, role: 'editor' }] }) }),
    },
  });

  const createdCalendar = await service.createCalendar(userId, { name: 'Integration calendar' });
  assert.equal(created.ownerUserId, userId);
  assert.equal(createdCalendar.role, 'owner');
  const calendars = await service.listCalendars(userId);
  assert.deepEqual(calendars.map((calendar) => [calendar.name, calendar.role]), [['Owned', 'owner'], ['Shared', 'editor']]);
});

test('accepting an old invitation does not change a direct member role', async () => {
  const service = loadWithMocks('../src/services/calendarService.js', {
    '../models/Calendar': {
      findById: async () => ({
        _id: 'calendar-id', ownerUserId: 'owner-id', name: 'Team', description: '', color: '#3B82F6', isMain: false,
      }),
    },
    '../models/CalendarMember': {
      findOne: async () => ({ _id: 'member-id', calendarId: 'calendar-id', userId: 'member-id', role: 'viewer' }),
    },
  });
  const calendar = await service.claimCalendarMembership('member-id', {
    calendarId: 'calendar-id', role: 'admin', createdByUserId: 'owner-id',
  });
  assert.equal(calendar.role, 'viewer');
});

test('calendar deletion removes its event records with other calendar data', async () => {
  let deletedEvents;
  const service = loadWithMocks('../src/services/calendarService.js', {
    '../models/Calendar': {
      findById: async () => ({ _id: 'calendar-id', ownerUserId: 'owner-id' }),
      deleteOne: async () => ({ deletedCount: 1 }),
    },
    '../models/CalendarMember': { deleteMany: async () => {}, findOne: async () => null },
    '../models/CalendarShareLink': { deleteMany: async () => {} },
    '../models/CalendarInvitation': { deleteMany: async () => {} },
    '../models/Event': { deleteMany: async (filter) => { deletedEvents = filter; } },
  });
  await service.deleteCalendarForUser('owner-id', 'calendar-id');
  assert.deepEqual(deletedEvents, { calendarId: 'calendar-id' });
});
