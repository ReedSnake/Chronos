import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDashboard } from './dashboardData.js';
import { eventDayKey } from '../events/eventForm.js';

const range={days:['2026-11-24','2026-11-25'],today:'2026-11-25'};
const meeting={id:'a',calendarId:'one',type:'arrangement',status:'scheduled',startsAt:'2026-11-24T23:00:00Z',endsAt:'2026-11-25T02:00:00Z'};
test('overnight meetings appear on both days without double counting meetings',()=>{
  const model=summarizeDashboard([meeting],range,'UTC');
  assert.deepEqual(model.days.map(d=>d.minutes),[60,120]);
  assert.equal(model.meetings.length,1);
  assert.equal(model.minutes,180);
  assert.equal(model.today.length,1);
});
test('calendar day boundaries use the calendar time zone',()=>{
  const model=summarizeDashboard([meeting],range,'Europe/Kyiv');
  assert.deepEqual(model.days.map(d=>d.minutes),[0,180]);
});
test('a meeting ending at midnight does not appear on the following day',()=>{
  const model=summarizeDashboard([{...meeting,endsAt:'2026-11-25T00:00:00Z'}],range,'UTC');
  assert.deepEqual(model.days.map(d=>d.events.length),[1,0]);
});
test('duplicate response rows and canceled events are excluded',()=>{
  const model=summarizeDashboard([meeting,meeting,{...meeting,id:'b',status:'canceled'}],range,'UTC');
  assert.equal(model.meetings.length,1);
  assert.equal(model.minutes,180);
});
test('tasks and reminders use their type-specific date after optimistic changes',()=>{
  assert.equal(eventDayKey({type:'task',startsAt:'2026-11-24T10:00:00Z',deadline:'2026-11-25T10:00:00Z'},'UTC'),'2026-11-25');
  assert.equal(eventDayKey({type:'reminder',startsAt:'2026-11-24T10:00:00Z',remindAt:'2026-11-25T10:00:00Z'},'UTC'),'2026-11-25');
  assert.equal(eventDayKey({type:'task',deadline:'invalid'},'UTC'),null);
});
