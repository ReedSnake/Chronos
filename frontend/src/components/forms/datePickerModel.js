const DAY = 86400000;

export function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return null;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && dayKey(date) === value ? date : null;
}
export function dayKey(date) { return date.toISOString().slice(0, 10); }
export function makeDay(year, month, day = 1) {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  return date;
}
export function todayKey(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const get = type => parts.find(part => part.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch { return todayKey(undefined); }
}
export function shiftMonth(date, amount) { return makeDay(date.getUTCFullYear(), date.getUTCMonth() + amount); }
export function monthDays(date, sunday = false) {
  const first = makeDay(date.getUTCFullYear(), date.getUTCMonth());
  const offset = (first.getUTCDay() + (sunday ? 0 : 6)) % 7;
  return Array.from({ length: 42 }, (_, index) => new Date(first.getTime() + (index - offset) * DAY));
}
export function allowedDay(key, min, max) {
  return !!parseDay(key) && (!parseDay(min) || key >= min) && (!parseDay(max) || key <= max);
}
export function monthAvailable(date, min, max) {
  if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return false;
  const first = dayKey(makeDay(date.getUTCFullYear(), date.getUTCMonth()));
  const last = dayKey(makeDay(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return (!parseDay(min) || last >= min) && (!parseDay(max) || first <= max);
}
