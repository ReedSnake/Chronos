import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWorkHours, planningWindow, isPastEvent, overdueTasks, nextMeeting, overdueWindow, countdownMinutes, selectedInterval } from './planningPreferences.js';
import { seedEventTime } from './calendarInteractions.js';
import { canWriteTask } from '../tasks/taskBoardModel.js';
import { canMoveEvent } from './eventQuickModel.js';

test('invalid working-hour preferences fall back safely',()=>{
  assert.deepEqual(normalizeWorkHours({start:19,end:8}),{start:8,end:20});
  assert.deepEqual(normalizeWorkHours({start:7,end:24}),{start:7,end:24});
  assert.deepEqual(planningWindow([],true,{start:9,end:18}),{first:0,last:24});
});
test('events outside configured working hours remain visible',()=>{
  assert.deepEqual(planningWindow([{start:390,end:450},{start:1290,end:1350}],false,{start:9,end:18}),{first:6,last:23});
  assert.deepEqual(planningWindow([],false,{start:9,end:17}),{first:9,last:17});
});
const now=Date.parse('2026-11-25T12:00:00Z');
const task={id:'a',calendarId:'c',type:'task',status:'todo',deadline:'2026-11-25T11:00:00Z'};
test('overdue tasks exclude completed, canceled, future and duplicate occurrences',()=>{
  const events=[task,task,{...task,id:'b',status:'done'},{...task,id:'c',deadline:'2026-11-25T12:00:00Z'},{...task,id:'d',status:'canceled'},{...task,id:'e',occurrenceId:'e1'},{...task,id:'e',occurrenceId:'e2'}];
  assert.equal(overdueTasks(events,now).length,3);
});
test('past filter does not hide overdue tasks or ongoing meetings',()=>{
  assert.equal(isPastEvent(task,now),false);
  assert.equal(isPastEvent({type:'arrangement',endsAt:'2026-11-25T13:00:00Z'},now),false);
  assert.equal(isPastEvent({type:'reminder',remindAt:'2026-11-25T11:00:00Z'},now),true);
});
test('countdown selects the next scheduled future meeting',()=>{
  const meeting={type:'arrangement',startsAt:'2026-11-25T12:45:00Z'};
  assert.deepEqual(nextMeeting([{...meeting,startsAt:'2026-11-25T12:20:00Z',status:'canceled'},task,meeting],now),meeting);
  assert.equal(countdownMinutes(meeting,now),45);
});
test('overdue query stays within the API range and includes today',()=>{
  const range=overdueWindow('2026-11-25','Europe/Kyiv');
  assert.equal(range.to,'2026-11-25T21:59:59.999Z');
  assert.equal(Date.parse(range.to)-Date.parse(range.from)<370*86400000,true);
  assert.deepEqual(range.types,['task']);
});
test('drag intervals handle reverse selection, minimum length and midnight',()=>{
  assert.deepEqual(selectedInterval(600,540,8,20),{start:540,duration:75});
  assert.deepEqual(selectedInterval(600,600,8,20),{start:600,duration:15});
  const selected=selectedInterval(1410,1425,0,24);
  assert.deepEqual(selected,{start:1410,duration:30});
  assert.equal(seedEventTime({},'2026-11-25',selected.start,selected.duration).endsAt,'2026-11-26T00:00');
});
test('only writable active non-holiday calendars permit task mutations',()=>{
  for(const role of ['owner','admin','editor'])assert.equal(canWriteTask({role}),true);
  for(const role of ['viewer','guest',null])assert.equal(canWriteTask({role}),false);
  assert.equal(canWriteTask({role:'owner',isArchived:true}),false);
  assert.equal(canWriteTask({role:'owner',isHolidayCalendar:true}),false);
  assert.equal(canWriteTask(null),false);
  assert.equal(canMoveEvent({...task,isRecurring:true}),false);
});
