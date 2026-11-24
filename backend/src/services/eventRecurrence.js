const AppError = require('../utils/AppError');
const DAY_MS = 86400000;
const MAX_OCCURRENCES = 25000;
const formatterCache = new Map();

function formatter(timeZone) {
  if (!formatterCache.has(timeZone)) formatterCache.set(timeZone, new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }));
  return formatterCache.get(timeZone);
}

function localParts(date, timeZone) {
  const result = Object.fromEntries(formatter(timeZone).formatToParts(date)
    .filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  return { ...result, millisecond: date.getUTCMilliseconds() };
}

function localAsUtc(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond);
}

function fromLocalParts(parts, timeZone) {
  const target = localAsUtc(parts);
  let guess = target;
  for (let i = 0; i < 4; i += 1) {
    const shown = localAsUtc(localParts(new Date(guess), timeZone));
    const next = guess + target - shown;
    if (next === guess) break;
    guess = next;
  }
  // A wall time in a DST gap does not exist; move forward to the first possible
  // local time instead of moving the occurrence into the previous day.
  if (localAsUtc(localParts(new Date(guess), timeZone)) < target) {
    guess += target - localAsUtc(localParts(new Date(guess), timeZone));
  }
  return new Date(guess);
}

function dayNumber(parts) { return Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS; }
function dateAtIndex(anchor, interval, index, timeZone) {
  let year = anchor.year;
  let month = anchor.month;
  let day = anchor.day;
  if (interval === 'daily' || interval === 'weekly') {
    const next = new Date(Date.UTC(year, month - 1, day + index * (interval === 'weekly' ? 7 : 1)));
    year = next.getUTCFullYear(); month = next.getUTCMonth() + 1; day = next.getUTCDate();
  } else if (interval === 'monthly') {
    const first = new Date(Date.UTC(year, month - 1 + index, 1));
    year = first.getUTCFullYear(); month = first.getUTCMonth() + 1;
    day = Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate());
  } else if (interval === 'yearly') {
    year += index;
    day = Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate());
  }
  return fromLocalParts({ ...anchor, year, month, day }, timeZone);
}

function firstIndex(anchor, interval, start, timeZone) {
  const target = localParts(start, timeZone);
  let estimate = 0;
  if (interval === 'daily') estimate = dayNumber(target) - dayNumber(anchor);
  if (interval === 'weekly') estimate = Math.floor((dayNumber(target) - dayNumber(anchor)) / 7);
  if (interval === 'monthly') estimate = (target.year - anchor.year) * 12 + target.month - anchor.month;
  if (interval === 'yearly') estimate = target.year - anchor.year;
  return Math.max(0, estimate - 2);
}

function occurrencesForEvent(event, from, to, timeZone = 'UTC') {
  const startsAt = new Date(event.startsAt);
  const endsAt = event.endsAt ? new Date(event.endsAt) : null;
  const duration = endsAt ? Math.max(0, endsAt - startsAt) : 0;
  if (!event.isRecurring || !event.recurrenceInterval) {
    return startsAt <= to && (endsAt || startsAt) >= from ? [{ ...event, startsAt }] : [];
  }
  const isAllDay = event.type === 'holiday';
  const zone = isAllDay ? 'UTC' : timeZone;
  const anchor = localParts(startsAt, zone);
  const lookBack = new Date(from.getTime() - duration);
  const index = firstIndex(anchor, event.recurrenceInterval, lookBack, zone);
  const output = [];
  const end = event.recurrenceEndDate ? new Date(event.recurrenceEndDate) : null;
  // A date-only recurrenceEndDate is stored as the end of that UTC day.
  // Interpret its calendar DAY in the calendar's own zone (not as a UTC instant).
  const endIsCalendarDay = end?.toISOString().endsWith('T23:59:59.999Z');
  const endDay = endIsCalendarDay ? end.toISOString().slice(0, 10) : null;
  // The index is advanced arithmetically even for a series created years ago.
  for (let i = index; ; i += 1) {
    if (output.length > MAX_OCCURRENCES) throw new AppError('Too many occurrences in the selected range', 400, 'EVENT_RANGE_TOO_LARGE');
    const occurrenceStart = dateAtIndex(anchor, event.recurrenceInterval, i, zone);
    if (occurrenceStart > to) break;
    if (endDay) {
      const local = localParts(occurrenceStart, zone);
      const dateKey = `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
      if (dateKey > endDay) break;
    } else if (end && occurrenceStart > end) break;
    if (occurrenceStart < startsAt || occurrenceStart.getTime() + duration < from.getTime()) continue;
    const shift = occurrenceStart.getTime() - startsAt.getTime();
    const shifted = (value) => value ? new Date(new Date(value).getTime() + shift) : null;
    output.push({
      ...event,
      startsAt: occurrenceStart,
      endsAt: shifted(event.endsAt),
      deadline: shifted(event.deadline),
      remindAt: shifted(event.remindAt),
      date: shifted(event.date),
      occurrenceId: `${event._id}@${occurrenceStart.toISOString()}`,
      isOccurrence: true,
    });
  }
  return output;
}

module.exports = { MAX_OCCURRENCES, occurrencesForEvent, localParts, fromLocalParts };
