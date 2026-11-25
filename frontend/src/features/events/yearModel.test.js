import test from 'node:test';
import assert from 'node:assert/strict';
import { yearRange, shiftYear, yearMonths, yearEventsByDay } from './yearModel.js';

test('year range covers all twelve months', () => {
  assert.deepEqual(yearRange('2026-11-25'), { from: '2026-01-01', to: '2026-12-31' });
});
test('year navigation preserves day and clamps leap day', () => {
  assert.equal(shiftYear('2024-02-29', 1), '2025-02-28');
  assert.equal(shiftYear('2026-12-31', -1), '2025-12-31');
});
test('month cells respect the first weekday and leap years', () => {
  const months = yearMonths('2024-01-01');
  assert.equal(months.length, 12);
  assert.equal(months[0].days[0], '2024-01-01');
  assert.equal(months[1].days.filter(Boolean).length, 29);
  assert.equal(months.flatMap(m => m.days).filter(Boolean).length, 366);
  assert.equal(yearMonths('2025-01-01').flatMap(m => m.days).filter(Boolean).length, 365);
  assert.equal(yearMonths('2024-01-01', 'sunday')[0].days[1], '2024-01-01');
});
test('year markers include overlapping meetings but exclude midnight end date', () => {
  const meeting = { type: 'arrangement', startsAt: '2025-12-31T18:00:00Z', endsAt: '2026-01-03T00:00:00Z' };
  assert.deepEqual(Object.keys(yearEventsByDay('2026-01-01', [meeting])), ['2026-01-01', '2026-01-02']);
});
test('year markers respect calendar timezone and date-only holidays', () => {
  const task = { type: 'task', deadline: '2026-12-30T23:30:00Z' };
  const holiday = { type: 'holiday', date: '2026-01-01' };
  const outside = { type: 'reminder', remindAt: '2027-01-01T10:00:00Z' };
  const groups = yearEventsByDay('2026-01-01', [task, holiday, outside], 'Europe/Kyiv');
  assert.deepEqual(groups['2026-12-31'], [task]);
  assert.deepEqual(groups['2026-01-01'], [holiday]);
  assert.equal(Object.keys(groups).length, 2);
});
