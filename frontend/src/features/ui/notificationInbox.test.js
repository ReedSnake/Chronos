import test from 'node:test';
import assert from 'node:assert/strict';
import { groupNotifications, upcomingReminders } from './notificationInbox.js';

const now = new Date('2026-11-27T01:00:00Z');
const rows = [
  { id:'old', dueAt:'2026-11-25T12:00:00Z', readAt:null },
  { id:'yesterday', dueAt:'2026-11-26T20:00:00Z', readAt:'2026-11-27T00:00:00Z' },
  { id:'today', dueAt:'2026-11-26T22:30:00Z', readAt:null },
  { id:'latest', dueAt:'2026-11-27T00:30:00Z', readAt:'2026-11-27T00:45:00Z' },
];
const ids = groups => groups.map(g => [g.key,g.items.map(n=>n.id)]);
test('groups by account timezone and sorts each day newest first, independently of read status', () => {
  assert.deepEqual(ids(groupNotifications([...rows,rows[0]],'all',now,'Europe/Kyiv')), [['today',['latest','today']],['yesterday',['yesterday']],['earlier',['old']]]);
  assert.deepEqual(ids(groupNotifications(rows,'all',now,'UTC')), [['today',['latest']],['yesterday',['today','yesterday']],['earlier',['old']]]);
});
test('read and unread filters preserve date groups and omit empty groups', () => {
  assert.deepEqual(ids(groupNotifications(rows,'unread',now,'Europe/Kyiv')), [['today',['today']],['earlier',['old']]]);
  assert.deepEqual(ids(groupNotifications(rows,'read',now,'Europe/Kyiv')), [['today',['latest']],['yesterday',['yesterday']]]);
  assert.deepEqual(groupNotifications([], 'all', now, 'UTC'), []);
});
const reminder = (id, remindAt, extra={}) => ({id,calendarId:'c',type:'reminder',remindAt,...extra});
test('upcoming reminders exclude elapsed, canceled and duplicate occurrences but keep future repetitions', () => {
  const next = reminder('r','2026-11-28T00:00:00Z');
  const delivered = reminder('r','2026-11-27T02:00:00Z');
  const notices = [{kind:'reminder',calendarId:'c',eventId:'r',dueAt:delivered.remindAt,readAt:'2026-11-27T02:30:00Z'}];
  assert.deepEqual(upcomingReminders([next,delivered,next,reminder('r','2026-11-27T00:00:00Z'),reminder('x','2026-11-27T03:00:00Z',{status:'canceled'})],notices,now),[next]);
});
test('a delivered reminder is not repeated after reading or when its notification falls outside the inbox limit', () => {
  const due = reminder('r','2026-11-27T01:00:00Z');
  assert.deepEqual(upcomingReminders([due],[],now),[]);
  const future = reminder('r','2026-11-28T01:00:00Z');
  const change = {kind:'event_created',calendarId:'c',eventId:'r',dueAt:future.remindAt};
  assert.deepEqual(upcomingReminders([future],[change],now),[future]);
});
