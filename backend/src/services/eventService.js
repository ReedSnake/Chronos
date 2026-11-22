const Event = require('../models/Event');
const { getUserCalendarAccess } = require('./calendarService');

function attendeeResponse(attendee) {
  return {
    email: attendee.email,
    expiresAt: attendee.expiresAt || null,
    inviteStatus: attendee.inviteStatus,
  };
}

function eventResponse(event) {
  return {
    id: String(event._id),
    calendarId: String(event.calendarId),
    type: event.type,
    title: event.title,
    description: event.description || '',
    color: event.color,
    isRecurring: event.isRecurring,
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

async function listEvents(calendarId, filters) {
  const query = { calendarId };
  if (filters.types.length) query.type = { $in: filters.types };
  if (filters.categories.length) query.categories = { $in: filters.categories };
  if (filters.from || filters.to) {
    query.startsAt = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.to ? { $lte: filters.to } : {}),
    };
  }
  const [events, total] = await Promise.all([
    Event.find(query).sort({ startsAt: 1, _id: 1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit),
    Event.countDocuments(query),
  ]);
  return {
    events: events.map(eventResponse),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  };
}

async function listCalendarEvents(userId, calendarId, filters) {
  await getUserCalendarAccess(userId, calendarId, 'viewer');
  return listEvents(calendarId, filters);
}

async function listSharedCalendarEvents(link, filters) {
  return listEvents(link.calendarId, filters);
}

module.exports = {
  eventResponse,
  listCalendarEvents,
  listSharedCalendarEvents,
};
