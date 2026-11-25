import test from 'node:test';
import assert from 'node:assert/strict';
import { moveEventPatch,resizeEventPatch,overlappingMeetings,duplicateEventPayload,canMoveEvent } from './eventQuickModel.js';
import { freeIntervals,unbookedMinutes,moveWidget } from '../dashboard/dashboardUxModel.js';

const meeting={id:'1',calendarId:'cal',type:'arrangement',title:'Meeting',status:'scheduled',startsAt:'2026-11-25T10:00:00.000Z',endsAt:'2026-11-25T11:00:00.000Z',attendees:[{email:'test@example.com'}],color:'#F5BC5A'};
test('move retains the original elapsed duration in the selected time zone',()=>{
  assert.deepEqual(moveEventPatch(meeting,'2026-11-26',9*60,'Europe/Kyiv'),{startsAt:'2026-11-26T07:00:00.000Z',endsAt:'2026-11-26T08:00:00.000Z'});
  assert.deepEqual(moveEventPatch(meeting,'2026-11-26',null,'Europe/Kyiv'),{startsAt:'2026-11-26T10:00:00.000Z',endsAt:'2026-11-26T11:00:00.000Z'});
});
test('resizing validates the end and allows midnight',()=>{
  assert.deepEqual(resizeEventPatch(meeting,'2026-11-25',1440,'UTC'),{endsAt:'2026-11-26T00:00:00.000Z'});
  assert.throws(()=>resizeEventPatch(meeting,'2026-11-25',600,'UTC'));
});
test('task moves update only the deadline and recurring series are protected',()=>{
  assert.deepEqual(moveEventPatch({type:'task',deadline:'2026-11-25T14:15:00.000Z'},'2026-11-26',null,'UTC'),{deadline:'2026-11-26T14:15:00.000Z'});
  assert.equal(canMoveEvent({...meeting,isRecurring:true}),false);
  assert.throws(()=>moveEventPatch({...meeting,isRecurring:true},'2026-11-26',600,'UTC'));
  assert.equal(canMoveEvent({type:'holiday'}),false);
});
test('overlap excludes the same event, adjacent meetings and canceled meetings',()=>{
  const other={...meeting,id:'2',startsAt:'2026-11-25T10:30:00.000Z',endsAt:'2026-11-25T11:30:00.000Z'};
  assert.equal(overlappingMeetings(meeting,[meeting,other,{...other,id:'3',status:'canceled'},{...other,id:'4',startsAt:meeting.endsAt}]).length,1);
});
test('copy does not inherit invitees, completion status or recurrence',()=>{
  const payload=duplicateEventPayload({...meeting,isRecurring:true,status:'canceled'});
  assert.equal(payload.isRecurring,false);
  assert.deepEqual(payload.attendees,[]);
  assert.equal(payload.status,'scheduled');
  assert.equal(Object.hasOwn(payload,'id'),false);
});
test('free time merges overlapping meetings rather than double counting',()=>{
  const events=[meeting,{...meeting,id:'2',startsAt:'2026-11-25T10:30:00.000Z',endsAt:'2026-11-25T12:00:00.000Z'}];
  assert.equal(unbookedMinutes(events,'2026-11-25','UTC'),420);
  assert.deepEqual(freeIntervals(events,'2026-11-25','UTC').map(([a,b])=>[new Date(a).toISOString().slice(11,16),new Date(b).toISOString().slice(11,16)]),[['09:00','10:00'],['12:00','18:00']]);
});
test('widget order stays unchanged at boundaries and supports reordering',()=>{
  assert.deepEqual(moveWidget(['a','b'],'a',-1),['a','b']);
  assert.deepEqual(moveWidget(['a','b'],'a',1),['b','a']);
});
