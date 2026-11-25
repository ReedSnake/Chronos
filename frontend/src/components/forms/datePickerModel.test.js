import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDay, dayKey, makeDay, shiftMonth, monthDays, allowedDay, monthAvailable } from './datePickerModel.js';

test('date picker rejects impossible dates and preserves leap days', () => {
  assert.equal(parseDay('2025-02-29'), null);
  assert.equal(dayKey(parseDay('2024-02-29')), '2024-02-29');
  assert.equal(parseDay('0000-01-01'), null);
});
test('month grid respects the preferred first weekday', () => {
  const month = makeDay(2026, 10);
  const monday = monthDays(month), sunday = monthDays(month, true);
  assert.equal(monday.length, 42);
  assert.equal(dayKey(monday[0]), '2026-10-26');
  assert.equal(dayKey(sunday[0]), '2026-11-01');
});
test('month navigation crosses year boundaries', () => {
  assert.equal(dayKey(shiftMonth(makeDay(2026, 11), 1)), '2027-01-01');
  assert.equal(dayKey(shiftMonth(makeDay(2026, 0), -1)), '2025-12-01');
});
test('date bounds are inclusive and unavailable months are disabled', () => {
  const min = '2026-11-24', max = '2027-02-15';
  assert.equal(allowedDay(min, min, max), true);
  assert.equal(allowedDay(max, min, max), true);
  assert.equal(allowedDay('2026-11-23', min, max), false);
  assert.equal(monthAvailable(makeDay(2026, 9), min, max), false);
  assert.equal(monthAvailable(makeDay(2027, 1), min, max), true);
  assert.equal(monthAvailable(makeDay(2027, 2), min, max), false);
});
