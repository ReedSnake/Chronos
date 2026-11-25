import { fromCalendarInput } from './eventForm.js';

export const DEFAULT_WORK_HOURS = { start: 8, end: 20 };

export function normalizeWorkHours(value) {
  const { start, end } = value || {};
  return Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= 24 && start < end
    ? { start, end } : { ...DEFAULT_WORK_HOURS };
}

export function planningWindow(blocks, fullDay = false, preferences = DEFAULT_WORK_HOURS) {
  if (fullDay) return { first: 0, last: 24 };
  const { start, end } = normalizeWorkHours(preferences);
  return {
    first: Math.max(0, Math.min(start, ...blocks.map(b => Math.floor(b.start / 60)))),
    last: Math.min(24, Math.max(end, ...blocks.map(b => Math.ceil(Math.max(b.end, b.start + 35) / 60)))),
  };
}

export function isPastEvent(event, now) {
  const value = event.type === 'arrangement' ? event.endsAt :
    event.type === 'reminder' ? event.remindAt : null;
  const stamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(stamp) && stamp <= Number(now);
}

export function overdueTasks(events, now) {
  const seen = new Set();
  return events.filter(e => {
    const key = e.calendarId + ':' + (e.occurrenceId || e.id);
    if (e.type !== 'task' || e.status === 'done' || e.status === 'canceled' ||
      !Number.isFinite(Date.parse(e.deadline)) || Date.parse(e.deadline) >= Number(now) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a,b) => Date.parse(a.deadline) - Date.parse(b.deadline));
}

export function nextMeeting(events, now) {
  return events.filter(e => e.type === 'arrangement' && e.status !== 'canceled' &&
    Date.parse(e.startsAt) > Number(now)).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt))[0] || null;
}

export function overdueWindow(today, zone) {
  const start = new Date(today + 'T12:00:00Z');
  start.setUTCDate(start.getUTCDate() - 365);
  const end = new Date(today + 'T12:00:00Z');
  end.setUTCDate(end.getUTCDate() + 1);
  return { from: fromCalendarInput(start.toISOString().slice(0,10)+'T00:00',zone),
    to: new Date(Date.parse(fromCalendarInput(end.toISOString().slice(0,10)+'T00:00',zone))-1).toISOString(), types:['task'] };
}

export function countdownMinutes(event, now) {
  return Math.max(0, Math.ceil((Date.parse(event.startsAt)-Number(now))/60000));
}

export function selectedInterval(anchor, target, first, last) {
  const min = first*60, max = last*60;
  const start = Math.max(min,Math.min(max-15,Math.min(anchor,target)));
  const end = Math.min(max,Math.max(start+15,Math.max(anchor,target)+15));
  return { start, duration: end-start };
}
