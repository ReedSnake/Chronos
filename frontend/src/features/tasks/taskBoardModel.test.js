import test from 'node:test';
import assert from 'node:assert/strict';
import { weekDates, monthDates, taskRange, apiRange, filterTasks, groupTasks, taskTime, canWriteTask, taskKey } from './taskBoardModel.js';

const day = '2026-11-24';
const tasks = [
  { id:'1', calendarId:'a', type:'task', title:'Design review', description:'Update layout', categories:['work'], attendees:[{email:'person@example.com'}], deadline:'2026-11-24T22:30:00Z', status:'todo' },
  { id:'2', calendarId:'b', type:'task', title:'Study', categories:['study'], deadline:'2026-11-24T08:00:00Z', status:'done' },
  { id:'3', calendarId:'a', type:'arrangement', title:'Meeting', deadline:'2026-11-24T08:00:00Z' }
];
test('week starts respect user preferences', () => {
  assert.equal(weekDates(day)[0], '2026-11-23');
  assert.equal(weekDates(day,'sunday')[0], '2026-11-22');
  assert.equal(weekDates(day)[6], '2026-11-29');
});
test('month includes complete six-week grid', () => {
  const dates = monthDates(day,'monday');
  assert.equal(dates.length,42);
  assert.equal(dates[0],'2026-10-26');
  assert.equal(dates.at(-1),'2026-12-06');
});
test('view ranges are independent of board filters', () => {
  const board = {from:'2026-10-01',to:'2026-12-31'};
  assert.deepEqual(taskRange('board',day,board,'monday'),board);
  assert.deepEqual(taskRange('day',day,board,'monday'),{from:day,to:day});
  assert.deepEqual(taskRange('week',day,board,'monday'),{from:'2026-11-23',to:'2026-11-29'});
});
test('API range includes the entire final local day', () => {
  assert.deepEqual(apiRange({from:day,to:day},'Europe/Kyiv'),{from:'2026-11-23T22:00:00.000Z',to:'2026-11-24T21:59:59.999Z',types:['task']});
  assert.throws(()=>apiRange({from:'2026-11-25',to:day},'UTC'));
});
test('filters combine status, calendar and category', () => {
  assert.deepEqual(filterTasks(tasks).map(e=>e.id),['2','1']);
  assert.deepEqual(filterTasks(tasks,{category:'work',status:'todo',hidden:['b']}).map(e=>e.id),['1']);
  assert.equal(filterTasks(tasks,{category:'work',hidden:['a']}).length,0);
  assert.deepEqual(filterTasks(tasks,{status:'done'}).map(e=>e.id),['2']);
  assert.equal(filterTasks(tasks,{category:'study',status:'todo'}).length,0);
});
test('deadline grouping uses display time zone', () => {
  const groups = groupTasks(filterTasks(tasks),'Europe/Kyiv');
  assert.equal(groups.get('2026-11-25')[0].id,'1');
  assert.equal(taskTime(tasks[0],'Europe/Kyiv'),'00:30');
});
test('calendar permissions and occurrence keys', () => {
  assert.equal(canWriteTask({role:'owner'}),true);
  assert.equal(canWriteTask({role:'viewer'}),false);
  assert.equal(canWriteTask({role:'editor',isArchived:true}),false);
  assert.equal(canWriteTask({role:'owner',isHolidayCalendar:true}),false);
  assert.equal(taskKey({...tasks[0],occurrenceId:'occ'}),'a:occ');
});
