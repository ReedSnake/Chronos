import assert from 'node:assert/strict';
import test from 'node:test';
import { CalendarService } from '../src/services/CalendarService.js';
import { formatSharedEventDate, updateSharedEventFilters } from '../src/features/calendars/sharedEvents.js';

function fakeHttp() {
  const calls = [];
  return {
    calls,
    get: async (...args) => { calls.push(['GET', ...args]); return { events: [], pagination: { page: 1, totalPages: 1 } }; },
    patch: async (...args) => { calls.push(['PATCH', ...args]); return { calendar: {} }; },
    delete: async (...args) => { calls.push(['DELETE', ...args]); return undefined; },
  };
}

test('public shared calendar and events use the link token, not a login session', async () => {
  const http = fakeHttp();
  const calendars = new CalendarService(http);
  await calendars.getShared('cs_secret.token');
  await calendars.listSharedEvents('cs_secret.token', {
    from: '2026-11-01', to: '2026-11-30', types: ['meeting', 'reminder'], page: 2, limit: 20,
  });
  await calendars.updateShared('cs_secret.token', { name: 'Revised' });
  assert.deepEqual(http.calls, [
    ['GET', '/calendar-share', { headers: { Authorization: 'CalendarLink cs_secret.token' } }],
    ['GET', '/calendar-share/events?from=2026-11-01&to=2026-11-30&types=meeting%2Creminder&page=2&limit=20', { headers: { Authorization: 'CalendarLink cs_secret.token' } }],
    ['PATCH', '/calendar-share', { name: 'Revised' }, { headers: { Authorization: 'CalendarLink cs_secret.token' } }],
  ]);
  assert.equal(typeof calendars.deleteShared, 'undefined');
});

test('event listing filters are independent of account calendar requests', async () => {
  const http = fakeHttp();
  const calendars = new CalendarService(http);
  await calendars.listEvents('calendar/#1', { categories: ['work'], page: 1 });
  assert.deepEqual(http.calls, [['GET', '/calendars/calendar%2F%231/events?categories=work&page=1']]);
});

test('share event date formatting uses calendar time zone and validates input', () => {
  const date = '2026-11-22T23:00:00.000Z';
  assert.match(formatSharedEventDate(date, 'en-US', 'Europe/Kyiv'), /Nov 23, 2026/);
  assert.match(formatSharedEventDate(date, 'en-US', 'UTC'), /Nov 22, 2026/);
  assert.equal(formatSharedEventDate('not-date', 'en-US'), '');
});

test('changing date filters resets pagination while paging preserves filters', () => {
  const state = { from: '', to: '', page: 4, limit: 20 };
  assert.deepEqual(updateSharedEventFilters(state, 'from', '2026-11-10'), { ...state, from: '2026-11-10', page: 1 });
  assert.deepEqual(updateSharedEventFilters(state, 'page', 3), { ...state, page: 3 });
  assert.deepEqual(updateSharedEventFilters(state, 'other', 'skip'), state);
});
