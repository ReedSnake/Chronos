const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { readFileSync } = require('node:fs');
const { validateEventCreate, validateEventUpdate, validateEventFilters, validateEventId } = require('../src/validators/eventValidators');
const { occurrencesForEvent } = require('../src/services/eventRecurrence');

const CALENDAR = '0123456789abcdef01234567';
const EVENT_ID = '123456789abcdef012345678';

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

test('event payloads use typed dates, default statuses, and strictly validated email arrays', () => {
  const arrangement = validateEventCreate({ type: 'arrangement', title: ' Team sync ', startsAt: '2026-12-01T10:00:00Z', endsAt: '2026-12-01T11:00:00Z', attendees: [' X@Example.test ', 'x@example.test'] });
  assert.equal(arrangement.title, 'Team sync');
  assert.equal(arrangement.status, 'scheduled');
  assert.deepEqual(arrangement.attendees, [{ email: 'x@example.test', inviteStatus: 'pending' }]);
  assert.equal(arrangement.startsAt.toISOString(), '2026-12-01T10:00:00.000Z');
  const task = validateEventCreate({ type: 'task', title: 'Release', deadline: '2026-12-01T10:00:00Z' });
  assert.equal(task.status, 'todo');
  assert.equal(task.startsAt.toISOString(), task.deadline.toISOString());
  assert.equal(validateEventCreate({ type: 'holiday', title: 'Freedom', date: '2026-12-01', internationalName: 'Freedom Day' }).startsAt.toISOString(), '2026-12-01T00:00:00.000Z');
  assert.equal(validateEventCreate({ type: 'reminder', title: 'Call', remindAt: '2026-12-01T10:00:00Z' }).startsAt.toISOString(), '2026-12-01T10:00:00.000Z');
  assert.throws(() => validateEventCreate({ type: 'task', title: 'Bad', deadline: '2026-02-30' }), /valid date/);
  assert.throws(() => validateEventCreate({ type: 'reminder', title: 'Bad', remindAt: '2026-12-01T10:00' }), /time zone/);
  assert.throws(() => validateEventCreate({ type: 'task', title: 'Bad', deadline: '2026-12-01', attendees: ['not-an-email'] }), /valid email/);
  assert.throws(() => validateEventUpdate({ type: 'holiday' }, 'task'), /Allowed fields/);
  assert.throws(() => validateEventId('not-a-valid-id'), /Invalid event ID/);
  assert.equal(validateEventId(EVENT_ID), EVENT_ID);
  assert.throws(() => validateEventFilters({ from: '2020-01-01', to: '2026-12-31' }), /370 days/);
});

test('recurring daily, weekly, monthly (31st), yearly (leap day) produce stable occurrence IDs', () => {
  const base = { _id: EVENT_ID, type: 'arrangement', isRecurring: true, startsAt: new Date('2026-01-31T10:00:00Z'), endsAt: new Date('2026-01-31T11:00:00Z') };
  const from = new Date('2026-01-01'); const to = new Date('2026-05-01');
  const months = occurrencesForEvent({ ...base, recurrenceInterval: 'monthly' }, from, to);
  assert.deepEqual(months.map((item) => item.startsAt.toISOString().slice(0, 10)), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  assert.notEqual(months[0].occurrenceId, months[1].occurrenceId);
  assert.equal(months[2].endsAt - months[2].startsAt, 3600000);
  const days = occurrencesForEvent({ ...base, recurrenceInterval: 'daily', recurrenceEndDate: new Date('2026-02-02T23:59:59Z') }, from, to);
  assert.equal(days.length, 3);
  const weeks = occurrencesForEvent({ ...base, recurrenceInterval: 'weekly' }, from, new Date('2026-02-15'));
  assert.equal(weeks.length, 3);
  const leaps = occurrencesForEvent({ ...base, startsAt: new Date('2024-02-29T10:00:00Z'), recurrenceInterval: 'yearly' }, new Date('2024-01-01'), new Date('2028-12-31'));
  assert.deepEqual(leaps.map((item) => item.startsAt.toISOString().slice(0, 10)), ['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
});

test('recurring occurrences retain the calendar local wall clock across DST', () => {
  const base = { _id: EVENT_ID, type: 'arrangement', isRecurring: true, recurrenceInterval: 'daily', startsAt: new Date('2026-03-27T08:00:00Z'), endsAt: new Date('2026-03-27T09:00:00Z') };
  const results = occurrencesForEvent(base, new Date('2026-03-27'), new Date('2026-03-31'), 'Europe/Kyiv');
  assert.deepEqual(results.map((item) => item.startsAt.toISOString()), [
    '2026-03-27T08:00:00.000Z', '2026-03-28T08:00:00.000Z',
    '2026-03-29T07:00:00.000Z', '2026-03-30T07:00:00.000Z',
  ]);
});

test('CRUD checks editor/viewer permissions and scopes events to the selected calendar', async () => {
  const calls = [];
  const changes = [];
  let eventExists = true;
  const stored = { _id: EVENT_ID, calendarId: CALENDAR, type: 'task', title: 'Draft', deadline: new Date('2026-12-01T10:00:00Z'), startsAt: new Date('2026-12-01T10:00:00Z'), attendees: [], set(values) { Object.assign(this, values); }, isModified: () => true, save: async () => { calls.push('saved'); } };
  const service = loadWithMocks('../src/services/eventService.js', {
    './notificationService': { notifyCalendarChange: async (calendar, actor, kind) => changes.push(kind) },
    '../models/Event': {
      create: async (values) => ({ _id: EVENT_ID, ...values }),
      findOne: (query) => { calls.push(query); const value = eventExists ? stored : null; return { then: (resolve) => Promise.resolve(value).then(resolve), select: async () => value }; },
      findOneAndDelete: async (query) => { calls.push(query); return eventExists ? stored : null; },
    },
    './calendarService': {
      getUserCalendarAccess: async (userId, calendarId, role) => { calls.push({ userId, calendarId, role }); return { calendar: { timeZone: 'UTC' }, role }; },
    },
  });
  const data = await service.createCalendarEvent('u', CALENDAR, validateEventCreate({ type: 'reminder', title: 'Call', remindAt: '2026-12-01T10:00:00Z', attendees: ['friend@example.test'] }));
  assert.equal(data.attendees[0].inviteToken, undefined);
  assert.equal(calls[0].role, 'editor');
  const result = await service.getCalendarEvent('u', CALENDAR, EVENT_ID);
  assert.equal(result.title, 'Draft');
  assert.equal(calls.at(-2).role, 'viewer');
  await service.updateCalendarEvent('u', CALENDAR, EVENT_ID, (type) => validateEventUpdate({ title: 'Final' }, type));
  assert.equal(stored.title, 'Final');
  await service.deleteCalendarEvent('u', CALENDAR, EVENT_ID);
  assert.deepEqual(calls.at(-1), { _id: EVENT_ID, calendarId: CALENDAR });
  assert.deepEqual(changes, ['event_created', 'event_updated', 'event_deleted']);
  eventExists = false;
  await assert.rejects(service.getCalendarEvent('u', CALENDAR, EVENT_ID), (error) => error.code === 'EVENT_NOT_FOUND');
});

test('event listing expands and paginates occurrences without disclosing attendee tokens', async () => {
  let observedQuery;
  const service = loadWithMocks('../src/services/eventService.js', {
    './notificationService': { notifyCalendarChange: async () => {} },
    '../models/Event': { find: (query) => { observedQuery = query; return { limit: () => ({ lean: async () => [{
      _id: EVENT_ID, calendarId: CALENDAR, type: 'task', title: 'Daily work',
      startsAt: new Date('2026-12-01T12:00:00.000Z'), deadline: new Date('2026-12-01T12:00:00.000Z'),
      isRecurring: true, recurrenceInterval: 'daily', attendees: [{ email: 'x@example.com', inviteToken: 'private-value' }],
    }] }) }; } },
    './calendarService': { getUserCalendarAccess: async () => ({ calendar: { timeZone: 'UTC' } }) },
  });
  const filters = { from: new Date('2026-12-01T00:00:00Z'), to: new Date('2026-12-04T23:59:59Z'), page: 2, limit: 2, types: [], categories: [] };
  const result = await service.listCalendarEvents('u', CALENDAR, filters);
  assert.equal(result.pagination.total, 4);
  assert.equal(result.pagination.totalPages, 2);
  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].startsAt.toISOString(), '2026-12-03T12:00:00.000Z');
  assert.equal(result.events[0].id, EVENT_ID);
  assert.ok(result.events[0].occurrenceId);
  assert.equal(result.events[0].attendees[0].inviteToken, undefined);
  assert.deepEqual(observedQuery.$or[0].isRecurring, true);
});

test('permission denial occurs before any event mutation', async () => {
  let written = false;
  const service = loadWithMocks('../src/services/eventService.js', {
    './notificationService': { notifyCalendarChange: async () => {} },
    '../models/Event': { create: async () => { written = true; }, deleteOne: async () => { written = true; } },
    './calendarService': { getUserCalendarAccess: async () => { throw new Error('No editor role'); } },
  });
  await assert.rejects(service.createCalendarEvent('u', CALENDAR, { title: 'Blocked' }), /No editor role/);
  await assert.rejects(service.deleteCalendarEvent('u', CALENDAR, EVENT_ID), /No editor role/);
  assert.equal(written, false);
});

test('date-only recurrence end is inclusive of the calendar day in negative UTC offsets', () => {
  const event = {
    _id: EVENT_ID, type: 'arrangement', isRecurring: true, recurrenceInterval: 'daily',
    startsAt: new Date('2026-11-28T07:30:00.000Z'), // Nov 27, 23:30 Los Angeles
    recurrenceEndDate: new Date('2026-11-30T23:59:59.999Z'),
  };
  const results = occurrencesForEvent(event, new Date('2026-11-28T00:00:00Z'), new Date('2026-12-02T00:00:00Z'), 'America/Los_Angeles');
  assert.deepEqual(results.map((entry) => entry.startsAt.toISOString()), [
    '2026-11-28T07:30:00.000Z', '2026-11-29T07:30:00.000Z',
    '2026-11-30T07:30:00.000Z', '2026-12-01T07:30:00.000Z',
  ]);
});
