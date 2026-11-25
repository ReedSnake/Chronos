import { fromCalendarInput, toCalendarInput } from './eventForm.js';
import { isCalendarDay } from './calendarInteractions.js';

export const eventIdentity = e => e.calendarId + ':' + (e.occurrenceId || e.id);
export const eventTimeField = e => ({arrangement:'startsAt',task:'deadline',reminder:'remindAt',holiday:'date'}[e.type]);
export const canMoveEvent = e => !!e && !e.isRecurring && e.type !== 'holiday' && !!eventTimeField(e);
export function moveEventPatch(event, day, minute, zone) {
  if (!canMoveEvent(event) || !isCalendarDay(day)) throw Error('invalidDate');
  const field=eventTimeField(event), old=toCalendarInput(event[field],zone);
  if (!old) throw Error('invalidDate');
  const time=minute==null?old.slice(11):String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
  const next=fromCalendarInput(day+'T'+time,zone);
  if(event.type!=='arrangement')return {[field]:next};
  const duration=Date.parse(event.endsAt)-Date.parse(event.startsAt);
  if(!Number.isFinite(duration)||duration<=0)throw Error('endAfterStart');
  return {startsAt:next,endsAt:new Date(Date.parse(next)+duration).toISOString()};
}
export function resizeEventPatch(event, day, minute, zone) {
  if (!canMoveEvent(event)||event.type!=='arrangement'||!isCalendarDay(day)||!Number.isInteger(minute)||minute<0||minute>1440) throw Error('invalidDate');
  const end=new Date(day+'T00:00:00Z');end.setUTCMinutes(minute);
  const endsAt=fromCalendarInput(end.toISOString().slice(0,16),zone);
  if(Date.parse(endsAt)-Date.parse(event.startsAt)<15*60000)throw Error('endAfterStart');
  return {endsAt};
}
export function overlappingMeetings(candidate,events) {
  if(candidate.type!=='arrangement'||candidate.status==='canceled')return [];
  const start=Date.parse(candidate.startsAt),end=Date.parse(candidate.endsAt);
  return events.filter(e=>e.type==='arrangement'&&e.status!=='canceled'&&(!candidate.id||e.id!==candidate.id||e.calendarId!==candidate.calendarId)&&Date.parse(e.startsAt)<end&&Date.parse(e.endsAt)>start);
}
export function duplicateEventPayload(event) {
  const payload={type:event.type,title:event.title,description:event.description||'',color:event.color,categories:event.categories||[],attendees:[],isRecurring:false,recurrenceInterval:null,recurrenceEndDate:null};
  if(event.type==='arrangement')Object.assign(payload,{startsAt:event.startsAt,endsAt:event.endsAt,status:'scheduled',locationUrl:event.locationUrl||null});
  if(event.type==='task')Object.assign(payload,{deadline:event.deadline,status:'todo'});
  if(event.type==='reminder')payload.remindAt=event.remindAt;
  if(event.type==='holiday')Object.assign(payload,{date:event.date?.slice(0,10),internationalName:event.internationalName});
  return payload;
}
