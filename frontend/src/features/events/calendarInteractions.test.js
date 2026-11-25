import test from 'node:test';
import assert from 'node:assert/strict';
import { isoWeek, weekRowNumber, isCalendarDay, slotMinute, seedEventTime } from './calendarInteractions.js';

test('ISO weeks handle year boundaries', () => {
  assert.equal(isoWeek('2021-01-01'), 53);
  assert.equal(isoWeek('2021-01-04'), 1);
  assert.equal(isoWeek('2026-12-31'), 53);
  assert.equal(isoWeek('2027-01-01'), 53);
  assert.equal(isoWeek('2027-01-04'), 1);
  assert.equal(weekRowNumber('2026-12-27', 'sunday'), 53);
});
test('date validation rejects missing and impossible dates', () => {
  assert.equal(isCalendarDay(null), false);
  assert.equal(isCalendarDay('2026-02-29'), false);
  assert.equal(isCalendarDay('2024-02-29'), true);
});
test('click positions snap down to a valid quarter hour', () => {
  assert.equal(slotMinute(0, 8, 20), 480);
  assert.equal(slotMinute(0.5, 8, 20), 840);
  assert.equal(slotMinute(1, 0, 24), 1425);
  assert.equal(slotMinute(-1, 8, 20), 480);
});
test('quick creation seeds date and time for all supported event types', () => {
  const draft = {title:'Example'};
  const seeded = seedEventTime(draft,'2026-11-25',1425,60);
  assert.equal(seeded.startsAt,'2026-11-25T23:45');
  assert.equal(seeded.endsAt,'2026-11-26T00:45');
  assert.equal(seeded.deadline,seeded.startsAt);
  assert.equal(seeded.remindAt,seeded.startsAt);
  assert.equal(seeded.date,'2026-11-25');
  assert.equal(seedEventTime(draft,'2026-11-25',null),draft);
});
