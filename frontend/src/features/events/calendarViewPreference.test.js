import test from 'node:test';
import assert from 'node:assert/strict';
import { CALENDAR_VIEWS, readCalendarView, saveCalendarView } from './calendarViewPreference.js';

function useStorage(t, storage) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  });
}

test('calendar preferences default to month and remember every valid view separately by account', (t) => {
  const values = new Map();
  useStorage(t, { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
  assert.equal(readCalendarView('a'), 'month');
  for (const view of CALENDAR_VIEWS) {
    saveCalendarView('a', view);
    assert.equal(readCalendarView('a'), view);
    assert.equal(readCalendarView('b'), 'month');
  }
  saveCalendarView('a', 'invalid');
  assert.equal(readCalendarView('a'), 'agenda');
  values.set('chronos.calendarView.a', 'removed-view');
  assert.equal(readCalendarView('a'), 'month');
  saveCalendarView(undefined, 'year');
  assert.equal(readCalendarView(undefined), 'month');
});

test('disabled storage does not prevent opening or switching views', (t) => {
  const unavailable = () => { throw new Error('Storage unavailable'); };
  useStorage(t, { getItem: unavailable, setItem: unavailable });
  assert.equal(readCalendarView('a'), 'month');
  assert.doesNotThrow(() => saveCalendarView('a', 'week'));
});
