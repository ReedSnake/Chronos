import { eventDayKey, fromCalendarInput, toCalendarInput } from '../events/eventForm.js';

export const TASK_STATES = ['todo', 'in_progress', 'done'];
export const taskKey = e => e.calendarId + ':' + (e.occurrenceId || e.id);
export const shiftDate = (day, amount) => {
  const date = new Date(day + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};
export function monthShift(day, amount) {
  const date = new Date(day.slice(0, 7) + '-01T12:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 10);
}
export function weekDates(day, startsOn = 'monday') {
  const n = new Date(day + 'T12:00:00Z').getUTCDay();
  const first = shiftDate(day, -(n + (startsOn === 'sunday' ? 0 : 6)) % 7);
  return Array.from({ length: 7 }, (_, i) => shiftDate(first, i));
}
export function monthDates(day, startsOn) {
  const first = day.slice(0, 7) + '-01', last = shiftDate(monthShift(day, 1), -1);
  const begin = weekDates(first, startsOn)[0], end = weekDates(last, startsOn)[6];
  const days = [];
  for (let d = begin; d <= end; d = shiftDate(d, 1)) days.push(d);
  return days;
}
export function taskRange(view, day, boardRange, startsOn) {
  if (view === 'board') return boardRange;
  const days = view === 'week' ? weekDates(day, startsOn) : view === 'month' ? monthDates(day, startsOn) : [day];
  return { from: days[0], to: days[days.length - 1] };
}
export function apiRange(range, zone) {
  if (!range.from || !range.to || range.from > range.to) throw new Error('Invalid date range');
  return { from: fromCalendarInput(range.from + 'T00:00', zone), to: new Date(Date.parse(fromCalendarInput(shiftDate(range.to, 1) + 'T00:00', zone)) - 1).toISOString(), types: ['task'] };
}
export function filterTasks(events, { hidden = [], category = '', status = '', search = '' } = {}) {
  const query = search.trim().toLowerCase();
  return events.filter(e => e.type === 'task' && !hidden.includes(e.calendarId) &&
    (!status || e.status === status) && (!category || (e.categories || []).includes(category)) &&
    (!query || [e.title, e.description, e.calendarName, ...(e.categories || []), ...(e.attendees || []).map(a => a.email)].some(v => String(v || '').toLowerCase().includes(query))))
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)) || taskKey(a).localeCompare(taskKey(b)));
}
export function groupTasks(tasks, zone) {
  const result = new Map();
  for (const task of tasks) {
    const day = eventDayKey(task, zone);
    if (!day) continue;
    if (!result.has(day)) result.set(day, []);
    result.get(day).push(task);
  }
  return result;
}
export function taskTime(task, zone) { return toCalendarInput(task.deadline, zone).slice(11, 16); }
export function canWriteTask(calendar) { return !!calendar && !calendar.isHolidayCalendar && !calendar.isArchived && ['owner', 'admin', 'editor'].includes(calendar.role); }
