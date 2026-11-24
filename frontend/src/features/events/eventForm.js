export const EVENT_TYPES = Object.freeze(['arrangement', 'task', 'reminder', 'holiday']);
export const RECURRENCE_INTERVALS = Object.freeze(['daily', 'weekly', 'monthly', 'yearly']);

const pad = (number) => String(number).padStart(2, '0');
const formatterCache = new Map();
function formatter(timeZone) {
  if (!formatterCache.has(timeZone)) formatterCache.set(timeZone, new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }));
  return formatterCache.get(timeZone);
}

function parts(date, timeZone) {
  return Object.fromEntries(formatter(timeZone).formatToParts(date)
    .filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}
function utcFromParts(value) { return Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second); }

export function toCalendarInput(value, timeZone = 'UTC') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const part = parts(date, timeZone);
  return `${part.year}-${pad(part.month)}-${pad(part.day)}T${pad(part.hour)}:${pad(part.minute)}`;
}

export function fromCalendarInput(value, timeZone = 'UTC') {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('invalidDate');
  const [, year, month, day, hour, minute] = match.map(Number);
  const requested = { year, month, day, hour, minute, second: 0 };
  const utc = utcFromParts(requested);
  let guess = utc;
  for (let i = 0; i < 5; i += 1) {
    const next = guess + utc - utcFromParts(parts(new Date(guess), timeZone));
    if (next === guess) break;
    guess = next;
  }
  const date = new Date(guess);
  if (Number.isNaN(guess) || toCalendarInput(date, timeZone) !== value) throw new Error('invalidDate');
  return date.toISOString();
}

export function defaultEventDraft(type = 'arrangement', timeZone = 'UTC', durationMinutes = 60) {
  const now = Date.now();
  const startsAt = toCalendarInput(new Date(now + 15 * 60000), timeZone);
  const endsAt = toCalendarInput(new Date(now + (15 + durationMinutes) * 60000), timeZone);
  const date = startsAt.slice(0, 10);
  return {
    type, title: '', description: '', color: '#3B82F6', startsAt, endsAt,
    deadline: startsAt, remindAt: startsAt, date,
    status: type === 'task' ? 'todo' : 'scheduled', locationUrl: '', internationalName: '',
    isRecurring: false, recurrenceInterval: 'weekly', recurrenceEndDate: '', attendeesText: '', categoriesText: '',
  };
}

export function draftFromEvent(event, timeZone = 'UTC') {
  const defaults = defaultEventDraft(event.type, timeZone);
  return {
    ...defaults, ...event,
    startsAt: toCalendarInput(event.startsAt, timeZone),
    endsAt: toCalendarInput(event.endsAt, timeZone),
    deadline: toCalendarInput(event.deadline, timeZone),
    remindAt: toCalendarInput(event.remindAt, timeZone),
    date: event.date?.slice(0, 10) || '',
    recurrenceInterval: event.recurrenceInterval || 'weekly',
    recurrenceEndDate: event.recurrenceEndDate?.slice(0, 10) || '',
    attendeesText: (event.attendees || []).map((item) => item.email).join(', '),
    categoriesText: (event.categories || []).join(', '),
    locationUrl: event.locationUrl || '',
    internationalName: event.internationalName || '',
  };
}

export function buildEventPayload(draft, timeZone = 'UTC') {
  const title = draft.title.trim();
  if (!title) throw new Error('titleRequired');
  const attendees = [...new Set(draft.attendeesText.split(/[\s,;]+/).map((value) => value.trim().toLowerCase()).filter(Boolean))];
  if (attendees.length > 50 || attendees.some((email) => email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('invalidAttendees');
  const categories = [...new Set(draft.categoriesText.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean))];
  if (categories.length > 20 || categories.some((item) => item.length > 64 || !/^[a-z0-9][a-z0-9 _-]*$/.test(item))) throw new Error('invalidCategories');
  const payload = {
    type: draft.type, title, description: draft.description, color: draft.color,
    attendees, categories, isRecurring: draft.isRecurring,
    recurrenceInterval: draft.isRecurring ? draft.recurrenceInterval : null,
    recurrenceEndDate: draft.isRecurring && draft.recurrenceEndDate ? draft.recurrenceEndDate : null,
  };
  if (draft.type === 'arrangement') {
    payload.startsAt = fromCalendarInput(draft.startsAt, timeZone);
    payload.endsAt = fromCalendarInput(draft.endsAt, timeZone);
    if (payload.endsAt <= payload.startsAt) throw new Error('endAfterStart');
    payload.status = draft.status === 'canceled' ? 'canceled' : 'scheduled';
    payload.locationUrl = draft.locationUrl.trim() || null;
  } else if (draft.type === 'task') {
    payload.deadline = fromCalendarInput(draft.deadline, timeZone);
    payload.status = ['todo', 'in_progress', 'done'].includes(draft.status) ? draft.status : 'todo';
  } else if (draft.type === 'reminder') {
    payload.remindAt = fromCalendarInput(draft.remindAt, timeZone);
  } else if (draft.type === 'holiday') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || new Date(`${draft.date}T00:00:00Z`).toISOString().slice(0, 10) !== draft.date) throw new Error('invalidDate');
    payload.date = draft.date;
    payload.internationalName = draft.internationalName.trim();
    if (!payload.internationalName) throw new Error('internationalNameRequired');
  }
  if (payload.isRecurring && payload.recurrenceEndDate) {
    const firstDay = (draft.type === 'arrangement' ? draft.startsAt : draft.type === 'task' ? draft.deadline : draft.type === 'reminder' ? draft.remindAt : draft.date).slice(0, 10);
    if (payload.recurrenceEndDate < firstDay) throw new Error('recurrenceEndTooEarly');
  }
  return payload;
}

export function eventDayKey(event, timeZone = 'UTC') {
  if (event.type === 'holiday') return event.date?.slice(0, 10) || null;
  const date = event.startsAt || event.deadline || event.remindAt;
  if (!date) return null;
  const part = parts(new Date(date), timeZone);
  return `${part.year}-${pad(part.month)}-${pad(part.day)}`;
}

export function eventDateLabel(event, locale, timeZone) {
  if (event.type === 'holiday') return eventDayKey(event, timeZone);
  const value = event.type === 'task' ? event.deadline : event.type === 'reminder' ? event.remindAt : event.startsAt;
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone });
}
