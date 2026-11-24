const AppError = require('../utils/AppError');
const { EVENT_TYPES, EVENT_STATUSES_BY_TYPE, RECURRENCE_INTERVALS } = require('../constants/eventTypes');

function invalid(message) {
  throw new AppError(message, 400, 'VALIDATION_ERROR');
}

function requireObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Expected a JSON object');
  return value;
}

function validateEventId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{24}$/i.test(value)) invalid('Invalid event ID');
  return value;
}

function parseDate(value, field, endOfDay = false) {
  if (value === null) return null;
  if (typeof value !== 'string') invalid(`${field} must be an ISO date or date-time`);
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/i.test(normalized)) {
    invalid(`${field} must be an ISO date or date-time with a time zone`);
  }
  const calendarPart = normalized.slice(0, 10);
  const [year, month, day] = calendarPart.split('-').map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.toISOString().slice(0, 10) !== calendarPart) invalid(`${field} must be a valid date`);
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime()) || (!normalized.includes('T') && date.toISOString().slice(0, 10) !== normalized)) {
    invalid(`${field} must be a valid date`);
  }
  if (endOfDay && !normalized.includes('T')) date.setUTCHours(23, 59, 59, 999);
  return date;
}

function parseValues(value, field) {
  if (value === undefined) return [];
  const rawValues = Array.isArray(value) ? value : [value];
  if (rawValues.some((item) => typeof item !== 'string')) invalid(`${field} must contain strings`);
  const values = rawValues.flatMap((item) => item.split(',')).map((item) => item.trim()).filter(Boolean);
  if (!values.length) invalid(`${field} must not be empty`);
  return [...new Set(values)];
}

function parseTypes(value) {
  const types = parseValues(value, 'types');
  if (types.some((type) => !EVENT_TYPES.includes(type))) invalid(`types must contain only: ${EVENT_TYPES.join(', ')}`);
  return types;
}

function parseCategories(value) {
  const categories = [...new Set(parseValues(value, 'categories').map((item) => item.toLowerCase()))];
  if (categories.some((item) => item.length > 64 || !/^[a-z0-9][a-z0-9 _-]*$/.test(item))) {
    invalid('categories must contain safe category names up to 64 characters');
  }
  return categories;
}

function parsePositiveInteger(value, field, defaultValue, maximum) {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > maximum) {
    invalid(`${field} must be an integer between 1 and ${maximum}`);
  }
  return Number(value);
}

function validateEventFilters(query, { allowTargetUserId = false } = {}) {
  const data = query && typeof query === 'object' ? query : {};
  const allowed = ['from', 'to', 'types', 'categories', 'page', 'limit', ...(allowTargetUserId ? ['targetUserId'] : [])];
  if (Object.keys(data).some((field) => !allowed.includes(field))) invalid(`Allowed filters: ${allowed.join(', ')}`);
  const from = data.from === undefined ? null : parseDate(data.from, 'from');
  const to = data.to === undefined ? null : parseDate(data.to, 'to', true);
  if (from && to && from > to) invalid('from must be before or equal to to');
  // Range-bounded recurrence expansion keeps list requests predictable.
  if (from && to && to - from > 370 * 86400000) invalid('The event range cannot exceed 370 days');
  return {
    from, to,
    types: data.types === undefined ? [] : parseTypes(data.types),
    categories: data.categories === undefined ? [] : parseCategories(data.categories),
    page: parsePositiveInteger(data.page, 'page', 1, 100000),
    limit: parsePositiveInteger(data.limit, 'limit', 50, 100),
  };
}

const COMMON_FIELDS = ['title', 'description', 'color', 'isRecurring', 'recurrenceInterval', 'recurrenceEndDate', 'attendees', 'categories'];
const SPECIFIC_FIELDS = {
  arrangement: ['startsAt', 'endsAt', 'locationUrl', 'status'],
  task: ['deadline', 'status'],
  reminder: ['remindAt'],
  holiday: ['date', 'internationalName'],
};
const DATE_FIELDS = new Set(['startsAt', 'endsAt', 'deadline', 'remindAt', 'date', 'recurrenceEndDate']);
const OPTIONAL_DATES = new Set(['endsAt', 'recurrenceEndDate']);

function validateEventPayload(body, { existingType } = {}) {
  const data = requireObject(body);
  const type = existingType || data.type;
  if (!EVENT_TYPES.includes(type)) invalid(`type must be one of: ${EVENT_TYPES.join(', ')}`);
  const allowed = [...COMMON_FIELDS, ...SPECIFIC_FIELDS[type], ...(!existingType ? ['type'] : [])];
  const fields = Object.keys(data);
  if (!fields.length || fields.some((field) => !allowed.includes(field))) invalid(`Allowed fields: ${allowed.join(', ')}`);
  if (!existingType && (!fields.includes('title') || !fields.includes(({
    arrangement: 'startsAt', task: 'deadline', reminder: 'remindAt', holiday: 'date',
  })[type]))) invalid('title and the event-specific date are required');

  const values = existingType ? {} : { type };
  for (const field of fields) {
    const value = data[field];
    if (field === 'type') continue;
    if (field === 'title' || field === 'internationalName') {
      const max = field === 'title' ? 200 : 200;
      if (typeof value !== 'string' || !value.trim() || value.trim().length > max) invalid(`${field} is required and must be at most ${max} characters`);
      values[field] = value.trim();
    } else if (field === 'description' || field === 'locationUrl') {
      const max = field === 'description' ? 4000 : 2000;
      if (value !== null && (typeof value !== 'string' || value.trim().length > max)) invalid(`${field} must be at most ${max} characters`);
      if (field === 'locationUrl' && value) {
        try {
          const url = new URL(value.trim());
          if (!['https:', 'http:'].includes(url.protocol)) invalid('locationUrl must be an HTTP(S) URL');
        } catch { invalid('locationUrl must be an HTTP(S) URL'); }
      }
      values[field] = value === null ? null : value.trim();
    } else if (field === 'color') {
      if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.trim())) invalid('color must be a six-digit hexadecimal color');
      values.color = value.trim().toUpperCase();
    } else if (DATE_FIELDS.has(field)) {
      if (value === null && !OPTIONAL_DATES.has(field)) invalid(`${field} is required`);
      values[field] = parseDate(value, field, field === 'recurrenceEndDate');
    } else if (field === 'status') {
      if (!EVENT_STATUSES_BY_TYPE[type]?.includes(value)) invalid(`Invalid status for ${type}`);
      values.status = value;
    } else if (field === 'isRecurring') {
      if (typeof value !== 'boolean') invalid('isRecurring must be a boolean');
      values.isRecurring = value;
    } else if (field === 'recurrenceInterval') {
      if (value !== null && !RECURRENCE_INTERVALS.includes(value)) invalid('Invalid recurrence interval');
      values.recurrenceInterval = value;
    } else if (field === 'attendees') {
      if (!Array.isArray(value) || value.length > 50) invalid('attendees must be an array of at most 50 emails');
      const emails = value.map((item) => typeof item === 'string' ? item.trim().toLowerCase() : '');
      if (emails.some((email) => email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) invalid('attendees must contain valid email addresses');
      values.attendees = [...new Set(emails)].map((email) => ({ email, inviteStatus: 'pending' }));
    } else if (field === 'categories') {
      if (!Array.isArray(value) || value.length > 20) invalid('categories must be an array with at most 20 values');
      values.categories = value.length ? parseCategories(value) : [];
    }
  }
  if (!existingType) {
    if (type === 'arrangement') values.status = values.status || 'scheduled';
    if (type === 'task') values.status = values.status || 'todo';
  }
  // For date-based types the canonical start always follows the type-specific date.
  if (type === 'task' && values.deadline) values.startsAt = values.deadline;
  if (type === 'reminder' && values.remindAt) values.startsAt = values.remindAt;
  if (type === 'holiday' && values.date) values.startsAt = values.date;
  if (!existingType && values.isRecurring && !values.recurrenceInterval) invalid('Recurring events need a recurrenceInterval');
  if (!existingType && !values.isRecurring && values.recurrenceInterval) invalid('Set isRecurring to true to use recurrenceInterval');
  if (values.isRecurring === false) { values.recurrenceInterval = null; values.recurrenceEndDate = null; }
  return values;
}

function validateEventCreate(body) { return validateEventPayload(body); }
function validateEventUpdate(body, existingType) { return validateEventPayload(body, { existingType }); }

module.exports = { validateEventCreate, validateEventUpdate, validateEventId, validateEventFilters };
