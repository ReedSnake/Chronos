const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const Module = require('node:module');
const path = require('node:path');

function loadWithMocks(relative, replacements) {
  const filename = path.resolve(__dirname, relative);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = Module._load;
  Module._load = function (request, parent, isMain) {
    if (parent?.filename === filename && Object.hasOwn(replacements, request)) return replacements[request];
    return original.call(this, request, parent, isMain);
  };
  try { loaded._compile(readFileSync(filename, 'utf8'), filename); }
  finally { Module._load = original; }
  return loaded.exports;
}

test('main and holiday calendar provisioning preserves existing names, country visibility and data', async () => {
  const records = [];
  const user = { _id: 'user', country: 'UA', settings: { timeZone: 'Europe/Kyiv' } };
  const find = (filter) => records.find((record) => Object.entries(filter).every(([k, v]) => record[k] === v));
  const service = loadWithMocks('../src/services/personalCalendarService.js', {
    '../models/Calendar': {
      init: async () => {}, findOne: async (filter) => find(filter),
      findOneAndUpdate: async (filter, update, options) => {
        let record = find(filter);
        if (!record && options.upsert) { record = { ...filter, ...update.$setOnInsert }; records.push(record); }
        if (record) Object.assign(record, update.$set);
        return record;
      },
      updateOne: async (filter, update) => Object.assign(find(filter), update.$set),
    },
    '../models/User': { findById: () => ({ select: () => ({ lean: async () => user }) }) },
  });
  await service.ensureMainCalendar(user);
  records[0].name = 'My existing calendar';
  records[0].isArchived = true;
  await service.ensurePersonalCalendars(user._id);
  assert.equal(records.length, 2);
  assert.equal(records[0].name, 'My existing calendar');
  assert.equal(records[0].isArchived, false);
  assert.equal(records[0].timeZone, 'Europe/Kyiv');
  const holidays = records[1];
  assert.equal(holidays.countryCode, 'UA');
  holidays.isArchived = true;
  user.country = 'DE';
  await service.ensurePersonalCalendars(user._id);
  assert.equal(records.length, 2);
  assert.equal(holidays.countryCode, 'DE');
  assert.equal(holidays.isArchived, true);
  delete user.country;
  await service.ensurePersonalCalendars(user._id);
  assert.equal(holidays.countryCode, null);
});

test('main calendar cannot be demoted, archived or deleted even through an admin share link', async () => {
  let writes = 0;
  const calendar = { _id: 'main', ownerUserId: 'owner', isMain: true };
  const service = loadWithMocks('../src/services/calendarService.js', {
    '../models/Calendar': { findById: async () => calendar, findByIdAndUpdate: async () => { writes += 1; return calendar; } },
    '../models/CalendarMember': { findOne: async () => ({ role: 'admin' }) },
    '../models/CalendarShareLink': {}, '../models/CalendarInvitation': {}, '../models/Event': {},
    '../models/Notification': {}, './notificationService': { notifyCalendarChange: async () => {} },
    './personalCalendarService': {},
  });
  for (const task of [
    () => service.createCalendar('owner', { isMain: true }),
    () => service.updateCalendarForUser('owner', 'main', { isMain: false }),
    () => service.updateCalendarForUser('admin', 'main', { isArchived: true }),
    () => service.deleteCalendarForUser('owner', 'main'),
    () => service.deleteCalendarForUser('admin', 'main'),
    () => service.updateCalendarForShareLink({ calendarId: 'main', role: 'admin' }, { isArchived: true }),
  ]) await assert.rejects(task, { code: 'CALENDAR_MAIN_FORBIDDEN' });
  assert.equal(writes, 0);
  await service.updateCalendarForUser('owner', 'main', { name: 'New title' });
  assert.equal(writes, 1);
  calendar.isMain = false;
  calendar.isHolidayCalendar = true;
  await assert.rejects(() => service.getUserCalendarAccess('owner', 'main', 'editor'), { code: 'HOLIDAY_CALENDAR_READ_ONLY' });
  await assert.rejects(() => service.getUserCalendarAccess('stranger', 'main'), { code: 'CALENDAR_NOT_FOUND' });
  await assert.rejects(() => service.updateCalendarForUser('owner', 'main', { name: 'Changed' }), { code: 'HOLIDAY_CALENDAR_READ_ONLY' });
  await service.updateCalendarForUser('owner', 'main', { isArchived: true });
  assert.equal(writes, 2);
});

test('national holidays use country, exact dates, stable IDs, filtering and one cached provider request', async (t) => {
  const service = require('../src/services/holidayService');
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  let calls = 0;
  const record = { countryCode: 'UA', date: '2026-01-01', localName: 'Новий рік', name: 'New Year', global: true, types: ['Public'] };
  global.fetch = async (url) => {
    calls += 1;
    assert.equal(url, 'https://date.nager.at/api/v3/PublicHolidays/2026/UA');
    return { ok: true, json: async () => [record, record, { ...record, global: false }, { ...record, types: ['Observance'] }, { ...record, date: '2026-02-30' }] };
  };
  const calendar = { _id: 'holiday-calendar', countryCode: 'UA', color: '#D97706' };
  const from = new Date('2026-01-01'), to = new Date('2026-01-31');
  const events = await service.listHolidays(calendar, { types: [], categories: [] }, from, to);
  assert.equal(events.length, 1);
  assert.equal(events[0].title, record.localName);
  assert.equal(events[0].date.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.match(events[0]._id, /^[a-f0-9]{24}$/);
  assert.deepEqual(await service.getHoliday(calendar, events[0]._id), events[0]);
  assert.equal(calls, 1);
  assert.deepEqual(await service.listHolidays(calendar, { types: ['task'], categories: [] }, from, to), []);
  global.fetch = async () => { throw new Error('network down'); };
  await assert.rejects(() => service.listHolidays({ ...calendar, countryCode: 'DE' }, { types: [], categories: [] }, from, to), { code: 'HOLIDAYS_UNAVAILABLE' });
});

test('event invitation stores only a hash, checks editor access, and consumes a valid response once', async () => {
  let token, stored, answered = false, role, sentAt = false;
  const email = 'friend@example.test';
  const event = { title: 'Review', startsAt: new Date('2026-12-01'), type: 'arrangement' };
  const service = loadWithMocks('../src/services/eventInvitationService.js', {
    '../models/Event': {
      findOneAndUpdate: async (filter, update) => {
        assert.equal(filter.attendees.$elemMatch.email, email);
        stored = update.$set['attendees.$.inviteToken'];
        assert.ok(update.$set['attendees.$.expiresAt'] > new Date());
        return event;
      },
      exists: async () => true,
      findOne: (filter) => ({ select: () => ({ lean: async () => !answered && filter.attendees.$elemMatch.inviteToken === stored ? event : null }) }),
      updateOne: async (filter, update) => {
        const query = filter.attendees.$elemMatch;
        if (query.inviteToken !== stored || answered) return { modifiedCount: 0 };
        if (update.$set['attendees.$.inviteStatus']) {
          assert.equal(update.$set['attendees.$.inviteToken'], null);
          answered = true;
        } else if (update.$set['attendees.$.invitationSentAt']) sentAt = true;
        return { modifiedCount: 1 };
      },
    },
    './calendarService': { getUserCalendarAccess: async (user, id, requiredRole) => { role = requiredRole; return { calendar: { timeZone: 'UTC' } }; } },
    '../config/mail': { ensureMailConfigured: () => {}, sendEventInvitationEmail: async (to, values) => { assert.equal(to, email); token = values.token; } },
    './emailDeliveryQueue': { enqueueEmailDelivery: (deliver) => deliver() },
  });
  assert.deepEqual(await service.sendInvitation('owner', 'calendar', 'event', email, 'en'), { messageCode: 'EVENT_INVITATION_SENT' });
  assert.equal(role, 'editor');
  assert.equal(stored, createHash('sha256').update(token).digest('hex'));
  assert.notEqual(token, stored);
  assert.equal(sentAt, true);
  assert.equal((await service.previewInvitation(token)).title, 'Review');
  assert.deepEqual(await service.respondInvitation(token, 'accepted'), { status: 'accepted' });
  await assert.rejects(() => service.respondInvitation(token, 'declined'), { code: 'EVENT_INVITATION_INVALID' });
  await assert.rejects(() => service.previewInvitation('invalid'), { code: 'EVENT_INVITATION_INVALID' });
});

test('failed SMTP clears the active invitation token and does not report success', async () => {
  let revoked = false;
  const service = loadWithMocks('../src/services/eventInvitationService.js', {
    '../models/Event': {
      findOneAndUpdate: async () => ({ title: 'Test', startsAt: new Date(), type: 'task' }),
      exists: async () => true,
      updateOne: async (filter, update) => { revoked = update.$set['attendees.$.inviteToken'] === null; },
    },
    './calendarService': { getUserCalendarAccess: async () => ({ calendar: { timeZone: 'UTC' } }) },
    '../config/mail': { ensureMailConfigured: () => {}, sendEventInvitationEmail: async () => { throw new Error('private details'); } },
    './emailDeliveryQueue': { enqueueEmailDelivery: (deliver) => deliver() },
  });
  await assert.rejects(() => service.sendInvitation('owner', 'calendar', 'event', 'friend@example.test', 'en'), { code: 'EMAIL_DELIVERY_FAILED' });
  assert.equal(revoked, true);
});

test('shared calendar settings notify only after a real successful change', async () => {
  const changes = [];
  let current = { _id: 'team', ownerUserId: 'owner', name: 'Team' };
  const service = loadWithMocks('../src/services/calendarService.js', {
    '../models/Calendar': { findById: async () => current, findByIdAndUpdate: async (_, update) => { current = { ...current, ...update.$set }; return current; } },
    '../models/CalendarMember': { findOne: async () => ({ role: 'editor' }) },
    '../models/CalendarShareLink': {}, '../models/CalendarInvitation': {}, '../models/Event': {}, '../models/Notification': {}, './personalCalendarService': {},
    './notificationService': { notifyCalendarChange: async (calendar, actor, kind) => changes.push([calendar.name, actor, kind]) },
  });
  await service.updateCalendarForUser('editor', 'team', { name: 'Team' });
  assert.equal(changes.length, 0);
  await service.updateCalendarForUser('editor', 'team', { name: 'Work' });
  assert.deepEqual(changes, [['Work','editor','calendar_updated']]);
});
