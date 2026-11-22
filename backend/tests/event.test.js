const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { readFileSync } = require('node:fs');
const Event = require('../src/models/Event');
const { validateEventFilters } = require('../src/validators/eventValidators');

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

test('event model validates type-specific fields and keeps attendee tokens private', async () => {
  const event = new Event({
    calendarId: '0123456789abcdef01234567',
    type: 'arrangement',
    title: 'Planning',
    startsAt: new Date('2026-12-01T10:00:00.000Z'),
    endsAt: new Date('2026-12-01T11:00:00.000Z'),
    status: 'scheduled',
    attendees: [{ email: 'person@example.test', inviteToken: 'secret-token' }],
  });
  await event.validate();
  assert.equal(event.attendees[0].email, 'person@example.test');
  assert.equal(Event.schema.path('attendees').schema.path('inviteToken').options.select, false);
  assert.ok(Event.schema.indexes().some(([keys]) => keys.calendarId === 1 && keys.startsAt === 1));
  assert.ok(Event.schema.indexes().some(([keys]) => keys.calendarId === 1 && keys.categories === 1 && keys.startsAt === 1));

  const invalidTask = new Event({
    calendarId: '0123456789abcdef01234567', type: 'task', title: 'Write release notes',
    deadline: new Date('2026-12-01T10:00:00.000Z'), status: 'scheduled',
  });
  await assert.rejects(invalidTask.validate());
});

test('event filters normalize categories, whole-day end dates, and reject invalid ranges', () => {
  const filters = validateEventFilters({
    from: '2026-12-01', to: '2026-12-31', types: 'task,reminder,task', categories: 'work,personal,work', page: '2', limit: '25',
  });
  assert.deepEqual(filters.types, ['task', 'reminder']);
  assert.deepEqual(filters.categories, ['work', 'personal']);
  assert.equal(filters.page, 2);
  assert.equal(filters.limit, 25);
  assert.equal(filters.to.toISOString(), '2026-12-31T23:59:59.999Z');
  assert.throws(() => validateEventFilters({ types: 'unknown' }), (error) => error.statusCode === 400);
  assert.throws(() => validateEventFilters({ from: '2026-12-31', to: '2026-12-01' }), (error) => error.statusCode === 400);
});

test('event listing checks calendar access and filters each event type by its date field', async () => {
  let eventQuery;
  const service = loadWithMocks('../src/services/eventService.js', {
    '../models/Event': {
      find: (query) => {
        eventQuery = query;
        return { sort: () => ({ skip: () => ({ limit: async () => [{
          _id: 'event-id', calendarId: 'calendar-id', type: 'task', title: 'Write release notes',
          description: '', color: '#3B82F6', isRecurring: false, startsAt: new Date('2026-12-02T10:00:00.000Z'),
          attendees: [{ email: 'person@example.test', inviteStatus: 'accepted' }], categories: ['work'],
        }] }) }) };
      },
      countDocuments: async () => 1,
    },
    './calendarService': { getUserCalendarAccess: async () => ({ role: 'viewer' }) },
  });
  const data = await service.listCalendarEvents('user-id', 'calendar-id', {
    from: new Date('2026-12-01T00:00:00.000Z'),
    to: new Date('2026-12-03T00:00:00.000Z'),
    types: ['task'], categories: ['work'], page: 1, limit: 50,
  });
  assert.equal(eventQuery.calendarId, 'calendar-id');
  assert.deepEqual(eventQuery.type, { $in: ['task'] });
  assert.deepEqual(eventQuery.categories, { $in: ['work'] });
  assert.equal(eventQuery.startsAt.$gte.toISOString(), '2026-12-01T00:00:00.000Z');
  assert.equal(data.events[0].attendees[0].inviteToken, undefined);
  assert.equal(data.events[0].startsAt.toISOString(), '2026-12-02T10:00:00.000Z');
  assert.deepEqual(data.pagination, { page: 1, limit: 50, total: 1, totalPages: 1 });
});
