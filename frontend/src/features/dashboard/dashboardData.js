import { eventDayKey, fromCalendarInput } from '../events/eventForm.js';

const keyOf = date => date.toISOString().slice(0, 10);
export function weekWindow(now, timeZone, startsOn = 'monday', weekOffset = 0) {
  const key = eventDayKey({ startsAt: now.toISOString() }, timeZone);
  const start = new Date(key + 'T00:00:00Z');
  const offset = (start.getUTCDay() + (startsOn === 'sunday' ? 0 : 6)) % 7;
  start.setUTCDate(start.getUTCDate() - offset + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start); date.setUTCDate(date.getUTCDate() + index); return keyOf(date);
  });
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 7);
  return { days, today: key, from: fromCalendarInput(days[0] + 'T00:00', timeZone), to: new Date(new Date(fromCalendarInput(keyOf(end) + 'T00:00', timeZone)).getTime()-1).toISOString() };
}

export async function loadDashboard(service, range) {
  const { calendars = [] } = await service.list();
  const active = calendars.filter(calendar => !calendar.isArchived);
  async function read(calendar) {
    const events = [];
    for (let page = 1; page <= 100; page++) {
      const result = await service.listEvents(calendar.id, { from: range.from, to: range.to, types: range.types || [], page, limit: 100 });
      events.push(...(result.events || []).map(event => ({ ...event, calendarId: calendar.id, calendarName: calendar.name })));
      if (page >= (result.pagination?.totalPages || 1)) return events;
    }
    throw new Error('EVENT_RANGE_TOO_LARGE');
  }
  const events = [];
  let failed = 0;
  for (let i = 0; i < active.length; i += 4) {
    const batch = await Promise.allSettled(active.slice(i, i + 4).map(read));
    for (const result of batch) if (result.status === 'fulfilled') events.push(...result.value); else failed++;
  }
  return { calendars: active, events, failed };
}

export function summarizeDashboard(events, range, timeZone) {
  const days = range.days.map(key => ({ key, events: [], minutes: 0 }));
  const byKey = new Map(days.map(day => [day.key, day]));
  for (const event of events) {
    if (event.status === 'canceled') continue;
    const key = eventDayKey(event, timeZone);
    const day = byKey.get(key);
    if (!day) continue;
    day.events.push(event);
    if (event.type === 'arrangement' && event.startsAt && event.endsAt) {
      const minutes = (Date.parse(event.endsAt) - Date.parse(event.startsAt)) / 60000;
      if (Number.isFinite(minutes) && minutes > 0) day.minutes += minutes;
    }
  }
  const visible = days.flatMap(day => day.events);
  const tasks = visible.filter(event => event.type === 'task').sort((a,b) => Number(a.status === 'done') - Number(b.status === 'done') || Date.parse(a.deadline) - Date.parse(b.deadline));
  const done = tasks.filter(event => event.status === 'done').length;
  const meetings = visible.filter(event => event.type === 'arrangement');
  const reminders = visible.filter(event => event.type === 'reminder');
  return { days, tasks, done, meetings, reminders, minutes: days.reduce((sum, day) => sum + day.minutes, 0), today: byKey.get(range.today)?.events || [] };
}
