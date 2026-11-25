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
