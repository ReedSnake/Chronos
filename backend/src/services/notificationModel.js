const { occurrencesForEvent } = require('./eventRecurrence');
const CATCH_UP_MS = 24 * 60 * 60 * 1000;

function dueReminders(event, from, to, zone) {
  if (event.type !== 'reminder' || event.status === 'canceled') return [];
  return occurrencesForEvent(event, from, to, zone).filter((occurrence) => {
    const due = new Date(occurrence.remindAt || occurrence.startsAt);
    return due >= from && due <= to && (!event.createdAt || due >= new Date(event.createdAt));
  });
}

function reminderRecord(userId, event) {
  const dueAt = new Date(event.remindAt || event.startsAt);
  return {
    _id: `${userId}:reminder:${event._id}:${dueAt.toISOString()}`,
    userId, kind: 'reminder', calendarId: event.calendarId, eventId: event._id,
    occurrenceId: event.occurrenceId || null, title: event.title, dueAt,
  };
}

function welcomeRecord(user) {
  return { _id: `${user._id}:welcome`, userId: user._id, kind: 'welcome', dueAt: user.emailVerifiedAt || new Date() };
}

module.exports = { CATCH_UP_MS, dueReminders, reminderRecord, welcomeRecord };
