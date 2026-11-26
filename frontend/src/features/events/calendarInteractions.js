// ISO week numbers and date/time selection are based on calendar dates, not machine timezone.
export function isoWeek(key) {
  const date = new Date(key + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const first = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - first) / 86400000) / 7);
}
export function weekRowNumber(first, startsOn = 'monday') {
  const date = new Date(first + 'T12:00:00Z');
  if (startsOn === 'sunday') date.setUTCDate(date.getUTCDate() + 1);
  return isoWeek(date.toISOString().slice(0,10));
}
export function isCalendarDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
export function slotMinute(fraction, first, last) {
  if (!Number.isFinite(fraction)) return first * 60;
  return Math.max(first*60, Math.min(last*60-15, Math.floor((first*60+fraction*(last-first)*60)/15)*15));
}
export function seedEventTime(draft, day, minute, duration = 60) {
  if (!isCalendarDay(day) || !Number.isFinite(minute)) return draft;
  const start = new Date(day + 'T00:00:00Z');
  start.setUTCMinutes(Math.max(0,Math.min(1439,Math.floor(minute))));
  const end = new Date(start.getTime() + (Number(duration) || 60)*60000);
  const startsAt = start.toISOString().slice(0,16);
  return {...draft, startsAt, endsAt:end.toISOString().slice(0,16), deadline:startsAt, remindAt:startsAt, date:day};
}

// Apply an explicit Agenda date without replacing the range with the displayed month.
export function updateAgendaRange(current, field, value) {
  if (!isCalendarDay(value) || !['from', 'to'].includes(field)) return current;
  const shift = (key, amount) => {
    const date = new Date(key + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  };
  const next = { ...current, [field]: value };
  if (field === 'from') {
    const limit = shift(value, 365);
    next.to = current.to < value ? value : current.to > limit ? limit : current.to;
  } else {
    const limit = shift(value, -365);
    next.from = current.from > value ? value : current.from < limit ? limit : current.from;
  }
  return next.from === current.from && next.to === current.to ? current : next;
}
