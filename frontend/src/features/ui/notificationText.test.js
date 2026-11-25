import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationText } from './notificationText.js';

test('welcome notification is localized', () => {
  assert.equal(notificationText({kind:'welcome'}, 'uk').title, 'Вітаємо в Chronos!');
  assert.equal(notificationText({kind:'welcome'}, 'en').title, 'Welcome to Chronos!');
});
test('reminder includes the event title', () => {
  assert.deepEqual(notificationText({kind:'reminder', title:'Study'}, 'en'), { title:'Reminder due', body:'Study' });
});

test('deadline message includes task, calendar and actual deadline in account time zone', () => {
  const data = { kind:'task_deadline', title:'Study', calendarName:'Team', eventAt:'2026-11-25T09:00:00Z' };
  const en = notificationText(data, 'en', 'Europe/Kyiv');
  assert.equal(en.title, 'Task deadline approaching');
  assert.match(en.body, /Study · Team/);
  assert.match(en.body, /11:00/);
  assert.equal(notificationText(data, 'uk').title, 'Наближається дедлайн');
});
test('shared calendar activity is localized and identifies its calendar', () => {
  for (const kind of ['event_created','event_updated','event_deleted','event_canceled','calendar_updated']) {
    const n = { kind, title:'Meeting', calendarName:'Team' };
    assert.notEqual(notificationText(n, 'en').title, 'Reminder due');
    assert.notEqual(notificationText(n, 'uk').title, 'Час нагадування');
    assert.equal(notificationText(n, 'en').body, 'Meeting · Team');
  }
});
