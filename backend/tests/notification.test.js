const test = require('node:test');
const assert = require('node:assert/strict');
const { dueReminders, reminderRecord, welcomeRecord } = require('../src/services/notificationModel');
const event = { _id: 'event', calendarId: 'calendar', title: 'Meeting preparation', type: 'reminder', startsAt: new Date('2026-11-24T09:00:00Z'), remindAt: new Date('2026-11-24T09:00:00Z'), createdAt: new Date('2026-11-23T09:00:00Z') };
const from = new Date('2026-11-24T08:00:00Z');
const to = new Date('2026-11-24T10:00:00Z');

test('reminders trigger at their due time, not before it', () => {
  assert.equal(dueReminders(event, from, new Date('2026-11-24T08:59:59Z'), 'UTC').length, 0);
  assert.equal(dueReminders(event, from, to, 'UTC').length, 1);
});
test('canceled, unrelated or retroactively created events do not trigger', () => {
  for (const changes of [{ status: 'canceled' }, { type: 'task' }, { createdAt: to }]) assert.equal(dueReminders({ ...event, ...changes }, from, to, 'UTC').length, 0);
});
test('repeating reminders have distinct occurrence keys; repeat scans have identical keys', () => {
  const recurring = { ...event, isRecurring: true, recurrenceInterval: 'daily' };
  const occurrences = dueReminders(recurring, from, new Date('2026-11-25T10:00:00Z'), 'Europe/Kyiv');
  assert.equal(occurrences.length, 2);
  const first = reminderRecord('user', occurrences[0]);
  assert.equal(first._id, reminderRecord('user', occurrences[0])._id);
  assert.notEqual(first._id, reminderRecord('user', occurrences[1])._id);
  assert.notEqual(first._id, reminderRecord('other', occurrences[0])._id);
});
test('expired recurrence does not generate an extra notification', () => {
  assert.equal(dueReminders({ ...event, isRecurring: true, recurrenceInterval: 'daily', recurrenceEndDate: to }, new Date('2026-11-25T08:00:00Z'), new Date('2026-11-25T10:00:00Z'), 'UTC').length, 0);
});
test('welcome identity is stable across logins and unique to the account', () => {
  const user = { _id: 'user', emailVerifiedAt: from };
  assert.equal(welcomeRecord(user)._id, welcomeRecord({ ...user, emailVerifiedAt: to })._id);
  assert.notEqual(welcomeRecord(user)._id, welcomeRecord({ ...user, _id: 'other' })._id);
});

const Module = require('node:module');
const path = require('node:path');
const { readFileSync } = require('node:fs');
function mockService(replacements) {
  const filename = path.resolve(__dirname, '../src/services/notificationService.js');
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

test('welcome only for newly registered verified users; repeated scans upsert without resetting read status', async () => {
  const writes = [];
  const service = mockService({ mongoose: {}, '../models/Notification': { updateOne: async (...args) => writes.push(args) }, '../models/Calendar': {}, '../models/CalendarMember': {}, '../models/Event': {}, '../config/logger': {} });
  await service.ensureWelcome({ _id: 'legacy', emailVerifiedAt: from });
  await service.ensureWelcome({ _id: 'unverified', welcomeNotificationEnabled: true });
  const user = { _id: 'new', emailVerifiedAt: from, welcomeNotificationEnabled: true };
  await service.ensureWelcome(user);
  await service.ensureWelcome(user);
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0][0], writes[1][0]);
  assert.equal(writes[0][2].upsert, true);
  assert.ok(writes[0][1].$setOnInsert);
  assert.equal(writes[0][1].$set, undefined);
});

test('mark read scopes the write to authenticated user and currently accessible calendars', async () => {
  let filter;
  const chain = records => ({ select: () => ({ lean: async () => records }) });
  const service = mockService({ mongoose: {}, '../models/Notification': { updateMany: async f => { filter = f; } }, '../models/Calendar': { find: () => chain([{ _id: 'allowed' }]) }, '../models/CalendarMember': { find: () => chain([]) }, '../models/Event': {}, '../config/logger': {} });
  await service.markRead('current', 'other:welcome');
  assert.equal(filter.userId, 'current');
  assert.equal(filter._id, 'other:welcome');
  assert.equal(filter.readAt, null);
  assert.deepEqual(filter.$or, [{ kind: 'welcome' }, { calendarId: { $in: ['allowed'] } }]);
});
