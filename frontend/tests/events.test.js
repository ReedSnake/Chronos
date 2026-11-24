import assert from 'node:assert/strict';
import test from 'node:test';
import { CalendarService } from '../src/services/CalendarService.js';
import { defaultEventDraft, buildEventPayload, draftFromEvent, eventDayKey, fromCalendarInput, toCalendarInput } from '../src/features/events/eventForm.js';

test('event CRUD routes are correctly scoped to the calendar and to a single series', async () => {
  const calls = [];
  const mock = {
    get: async (...args) => { calls.push(['GET', ...args]); return {}; },
    post: async (...args) => { calls.push(['POST', ...args]); return {}; },
    patch: async (...args) => { calls.push(['PATCH', ...args]); return {}; },
    delete: async (...args) => { calls.push(['DELETE', ...args]); return {}; },
  };
  const service = new CalendarService(mock);
  await service.getEvent('a/b', 'xyz');
  await service.createEvent('a/b', { title: 'Meeting' });
  await service.updateEvent('a/b', 'xyz', { title: 'Meeting 2' });
  await service.deleteEvent('a/b', 'xyz');
  assert.deepEqual(calls, [
    ['GET', '/calendars/a%2Fb/events/xyz'], ['POST', '/calendars/a%2Fb/events', { title: 'Meeting' }],
    ['PATCH', '/calendars/a%2Fb/events/xyz', { title: 'Meeting 2' }], ['DELETE', '/calendars/a%2Fb/events/xyz'],
  ]);
});

test('typed event forms serialize attendance and event-specific dates', () => {
  const task = { ...defaultEventDraft('task'), title: 'Ship', deadline: '2026-12-01T12:30', attendeesText: ' A@EXAMPLE.com, a@example.com; B@example.com ', categoriesText: 'work, launch' };
  const payload = buildEventPayload(task, 'UTC');
  assert.equal(payload.deadline, '2026-12-01T12:30:00.000Z');
  assert.deepEqual(payload.attendees, ['a@example.com', 'b@example.com']);
  assert.deepEqual(payload.categories, ['work', 'launch']);
  assert.equal(payload.status, 'todo');
  const holiday = buildEventPayload({ ...defaultEventDraft('holiday'), title: 'Holiday', date: '2026-12-25', internationalName: 'Christmas' });
  assert.equal(holiday.date, '2026-12-25');
  assert.equal(holiday.internationalName, 'Christmas');
  const recurring = buildEventPayload({ ...task, isRecurring: true, recurrenceInterval: 'weekly', recurrenceEndDate: '2027-01-01' });
  assert.equal(recurring.recurrenceInterval, 'weekly');
  assert.throws(() => buildEventPayload({ ...task, attendeesText: 'not-an-email' }), /invalidAttendees/);
  assert.throws(() => buildEventPayload({ ...task, isRecurring: true, recurrenceEndDate: '2020-01-01' }), /recurrenceEndTooEarly/);
});

test('calendar time zone roundtrip supports DST, including offset changes', () => {
  const kyiv = 'Europe/Kyiv';
  assert.equal(fromCalendarInput('2026-03-29T10:30', kyiv), '2026-03-29T07:30:00.000Z');
  assert.equal(toCalendarInput('2026-03-29T07:30:00Z', kyiv), '2026-03-29T10:30');
  assert.throws(() => fromCalendarInput('2026-03-29T03:30', kyiv), /invalidDate/);
  assert.equal(eventDayKey({ type: 'holiday', date: '2026-01-01T00:00:00.000Z' }, 'America/New_York'), '2026-01-01');
  const event = { type: 'arrangement', startsAt: '2026-03-29T07:30:00Z', endsAt: '2026-03-29T08:30:00Z', attendees: [{ email: 'example@test.com' }], categories: ['work'] };
  const draft = draftFromEvent(event, kyiv);
  assert.equal(draft.startsAt, '2026-03-29T10:30');
  assert.equal(draft.attendeesText, 'example@test.com');
});
