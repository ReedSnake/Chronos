import { eventDayKey, toCalendarInput } from './eventForm.js';

const pad = value => String(value).padStart(2, '0');
const keyFor = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;

export function yearRange(day) {
  const year = day.slice(0, 4);
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function shiftYear(day, offset) {
  const year = Number(day.slice(0, 4)) + offset;
  const month = Number(day.slice(5, 7)) - 1;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return keyFor(year, month, Math.min(Number(day.slice(8)), last));
}

export function yearMonths(day, startsOn = 'monday') {
  const year = Number(day.slice(0, 4));
  return Array.from({ length: 12 }, (_, month) => {
    const first = keyFor(year, month, 1);
    const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + (startsOn === 'sunday' ? 0 : 6)) % 7;
    const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const days = Array.from({ length: 42 }, (_, index) => {
      const number = index - offset + 1;
      return number >= 1 && number <= length ? keyFor(year, month, number) : null;
    });
    return { first, days };
  });
}

export function yearEventsByDay(day, events, zone = 'UTC') {
  const { from, to } = yearRange(day);
  const grouped = {};
  for (const event of events) {
    const start = eventDayKey(event, zone);
    if (!start) continue;
    const endTime = Date.parse(event.endsAt);
    const end = event.type === 'arrangement' && endTime > Date.parse(event.startsAt)
      ? toCalendarInput(new Date(endTime - 1), zone).slice(0, 10) : start;
    const first = start < from ? from : start;
    const last = end > to ? to : end;
    if (first > last) continue;
    const cursor = new Date(`${first}T12:00:00Z`);
    for (let key = first; key <= last;) {
      (grouped[key] ||= []).push(event);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      key = cursor.toISOString().slice(0, 10);
    }
  }
  return grouped;
}
