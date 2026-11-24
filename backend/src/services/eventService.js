const { listHolidays, getHoliday } = require('./holidayService');
const Event = require('../models/Event');
const AppError = require('../utils/AppError');
const { getUserCalendarAccess } = require('./calendarService');
const { occurrencesForEvent, MAX_OCCURRENCES, localParts } = require('./eventRecurrence');

function attendeeResponse(attendee) {
  return {
    email: attendee.email,
    expiresAt: attendee.expiresAt || null,
    inviteStatus: attendee.inviteStatus,
    invitationSentAt: attendee.invitationSentAt || null,
  };
}

function eventResponse(event) {
  return {
    id: String(event._id),
    calendarId: String(event.calendarId),
    occurrenceId: event.occurrenceId || null,
    isOccurrence: Boolean(event.isOccurrence),
    type: event.type,
    title: event.title,
    description: event.description || '',
    color: event.color,
    isRecurring: Boolean(event.isRecurring),
    recurrenceInterval: event.recurrenceInterval || null,
    recurrenceEndDate: event.recurrenceEndDate || null,
    startsAt: event.startsAt,
    endsAt: event.endsAt || null,
    locationUrl: event.locationUrl || null,
    status: event.status || null,
    attendees: (event.attendees || []).map(attendeeResponse),
    categories: event.categories || [],
    deadline: event.deadline || null,
    subCategory: event.subCategory || null,
    remindAt: event.remindAt || null,
    date: event.date || null,
    internationalName: event.internationalName || null,
    createdAt: event.createdAt || null,
    updatedAt: event.updatedAt || null,
  };
}

function windowForFilters(filters) {
  const now = Date.now();
  const from = filters.from || (filters.to ? new Date(filters.to.getTime() - 90 * 86400000) : new Date(now - 30 * 86400000));
  const to = filters.to || new Date(from.getTime() + 90 * 86400000);
  return { from, to };
}

function baseEventQuery(calendarId, filters, from, to) {
  return {
    calendarId,
    ...(filters.types.length ? { type: { $in: filters.types } } : {}),
    ...(filters.categories.length ? { categories: { $in: filters.categories } } : {}),
    startsAt: { $lte: to },
    $or: [
      { isRecurring: true, $or: [{ recurrenceEndDate: null }, { recurrenceEndDate: { $gte: new Date(from.getTime() - 2 * 86400000) } }] },
      { isRecurring: { $ne: true }, $or: [{ startsAt: { $gte: from } }, { endsAt: { $gte: from } }] },
    ],
  };
}

async function listEvents(calendarId, filters, timeZone = 'UTC', holidayCalendar = null) {
  const { from, to } = windowForFilters(filters);
  if (to - from > 370 * 86400000) {
    throw new AppError('The event range cannot exceed 370 days', 400, 'EVENT_RANGE_TOO_LARGE');
  }
  if (holidayCalendar) {
    const records = await listHolidays(holidayCalendar, filters, from, to);
    records.sort((a, b) => a.startsAt - b.startsAt || String(a._id).localeCompare(String(b._id)));
    const total = records.length;
    return { events: records.slice((filters.page - 1) * filters.limit, filters.page * filters.limit).map(eventResponse), pagination: { page: filters.page, limit: filters.limit, total, totalPages: Math.max(1, Math.ceil(total / filters.limit)) } };
  }
  const records = await Event.find(baseEventQuery(calendarId, filters, from, to)).limit(10001).lean();
  if (records.length > 10000) throw new AppError('Too many events in the selected range', 400, 'EVENT_RANGE_TOO_LARGE');
  const result = [];
  for (const record of records) {
    result.push(...occurrencesForEvent(record, from, to, timeZone));
    if (result.length > MAX_OCCURRENCES) throw new AppError('Too many occurrences in the selected range', 400, 'EVENT_RANGE_TOO_LARGE');
  }
  result.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)
    || String(a._id).localeCompare(String(b._id)));
  const total = result.length;
  const events = result.slice((filters.page - 1) * filters.limit, filters.page * filters.limit);
  return {
    events: events.map(eventResponse),
    pagination: { page: filters.page, limit: filters.limit, total, totalPages: Math.max(1, Math.ceil(total / filters.limit)) },
  };
}

async function listCalendarEvents(userId, calendarId, filters) {
  const { calendar } = await getUserCalendarAccess(userId, calendarId, 'viewer');
  return listEvents(calendarId, filters, calendar?.timeZone || 'UTC', calendar?.isHolidayCalendar ? calendar : null);
}

async function listSharedCalendarEvents(link, filters) {
  // A public link can only read; the calendar's time zone is required for
  // recurring occurrences across DST and for the same results as signed-in users.
  const Calendar = require('../models/Calendar');
  const calendar = await Calendar.findById(link.calendarId);
  if (!calendar) throw new AppError('Calendar not found', 404, 'CALENDAR_NOT_FOUND');
  if (calendar.isHolidayCalendar) throw missing();
  const result = await listEvents(link.calendarId, filters, calendar.timeZone || 'UTC');
  return { ...result, events: result.events.map((event) => ({ ...event, attendees: [] })) };
}

function missing() { return new AppError('Event not found', 404, 'EVENT_NOT_FOUND'); }
function handleEventValidationError(error) {
  if (error?.name === 'VersionError') throw new AppError('Event changed; reload and try again', 409, 'EVENT_CHANGED');
  if (['ValidationError', 'CastError'].includes(error?.name)) {
    throw new AppError('Invalid event fields', 400, 'VALIDATION_ERROR');
  }
  throw error;
}

async function getCalendarEvent(userId, calendarId, eventId) {
  const { calendar } = await getUserCalendarAccess(userId, calendarId, 'viewer');
  const event = calendar?.isHolidayCalendar
    ? await getHoliday(calendar, eventId) : await Event.findOne({ _id: eventId, calendarId });
  if (!event) throw missing();
  return eventResponse(event);
}

function validateRecurrenceBound(event, calendar) {
  if (!event.isRecurring || !event.recurrenceEndDate) return;
  const start = new Date(event.startsAt);
  const end = new Date(event.recurrenceEndDate);
  if (end.toISOString().endsWith('T23:59:59.999Z')) {
    const zone = event.type === 'holiday' ? 'UTC' : (calendar?.timeZone || 'UTC');
    const parts = localParts(start, zone);
    const startDay = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
    if (end.toISOString().slice(0, 10) < startDay) {
      throw new AppError('Recurrence end precedes the first event', 400, 'VALIDATION_ERROR');
    }
  } else if (end < start) {
    throw new AppError('Recurrence end precedes the first event', 400, 'VALIDATION_ERROR');
  }
}

async function createCalendarEvent(userId, calendarId, values) {
  const { calendar } = await getUserCalendarAccess(userId, calendarId, 'editor');
  validateRecurrenceBound(values, calendar);
  try {
    const event = await Event.create({ ...values, calendarId });
    return eventResponse(event);
  } catch (error) { handleEventValidationError(error); }
}

async function updateCalendarEvent(userId, calendarId, eventId, validateValues) {
  const { calendar } = await getUserCalendarAccess(userId, calendarId, 'editor');
  const event = await Event.findOne({ _id: eventId, calendarId }).select('+attendees.inviteToken +attendees.lastInviteAttemptAt');
  if (!event) throw missing();
  const values = validateValues(event.type);
  if (values.attendees) {
    const existing = new Map(event.attendees.map((attendee) => [attendee.email, attendee]));
    values.attendees = values.attendees.map((attendee) => existing.get(attendee.email) || attendee);
  }
  event.set(values);
  validateRecurrenceBound(event, calendar);
  try {
    await event.save(); // Full Mongoose document validation, not findOneAndUpdate bypass.
  } catch (error) { handleEventValidationError(error); }
  return eventResponse(event);
}

async function deleteCalendarEvent(userId, calendarId, eventId) {
  await getUserCalendarAccess(userId, calendarId, 'editor');
  const deleted = await Event.deleteOne({ _id: eventId, calendarId });
  if (!deleted.deletedCount) throw missing();
}

module.exports = {
  eventResponse, listCalendarEvents, listSharedCalendarEvents,
  createCalendarEvent, getCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
};
