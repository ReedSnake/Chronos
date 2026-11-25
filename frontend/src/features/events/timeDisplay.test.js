import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEventTime, formatMinute } from './timeDisplay.js';
import { fromCalendarInput, toCalendarInput, eventDayKey } from './eventForm.js';

test('changing display zones preserves the same UTC instant',()=>{
  const instant=fromCalendarInput('2026-11-25T22:00','Europe/Kyiv');
  assert.equal(instant,'2026-11-25T20:00:00.000Z');
  assert.equal(toCalendarInput(instant,'Africa/Nairobi'),'2026-11-25T23:00');
  assert.equal(toCalendarInput(instant,'America/New_York'),'2026-11-25T15:00');
  assert.equal(fromCalendarInput('2026-11-25T23:00','Africa/Nairobi'),instant);
});
test('day grouping follows the account zone, including midnight',()=>{
  const event={type:'task',deadline:'2026-11-25T22:30:00.000Z'};
  assert.equal(eventDayKey(event,'Europe/Kyiv'),'2026-11-26');
  assert.equal(eventDayKey(event,'America/New_York'),'2026-11-25');
  assert.equal(eventDayKey({type:'holiday',date:'2026-11-25'},'Africa/Nairobi'),'2026-11-25');
});
test('12 and 24 hour formats distinguish noon and midnight',()=>{
  assert.equal(formatEventTime('2026-11-25T00:00:00Z','en-US','UTC','24h'),'00:00');
  assert.match(formatEventTime('2026-11-25T00:00:00Z','en-US','UTC','12h'),/12:00\s*AM/);
  assert.match(formatEventTime('2026-11-25T12:00:00Z','en-US','UTC','12h'),/12:00\s*PM/);
  assert.match(formatMinute(13*60+15,'en-US','12h'),/01:15\s*PM/);
  assert.equal(formatMinute(13*60+15,'en-US','24h'),'13:15');
});
test('daylight saving conversion uses the date-specific offset',()=>{
  assert.equal(fromCalendarInput('2026-07-01T12:00','Europe/Kyiv'),'2026-07-01T09:00:00.000Z');
  assert.equal(fromCalendarInput('2026-01-01T12:00','Europe/Kyiv'),'2026-01-01T10:00:00.000Z');
});
