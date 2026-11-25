const { occurrencesForEvent } = require('./eventRecurrence');
const CATCH_UP_MS = 24 * 60 * 60 * 1000;
const DEADLINE_LEAD_MS = 24 * 60 * 60 * 1000;

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

function upcomingDeadlines(event, now, zone) {
  if (event.type !== 'task' || !['todo', 'in_progress'].includes(event.status)) return [];
  const end = new Date(now.getTime() + DEADLINE_LEAD_MS);
  return occurrencesForEvent(event, now, end, zone).filter(occurrence => {
    const deadline = new Date(occurrence.deadline || occurrence.startsAt);
    return deadline > now && deadline <= end;
  });
}

function deadlineRecord(userId, event, calendar, now) {
  const eventAt = new Date(event.deadline || event.startsAt);
  return {
    _id: `${userId}:task_deadline:${event._id}:${eventAt.toISOString()}`,
    userId, kind: 'task_deadline', calendarId: event.calendarId, eventId: event._id,
    occurrenceId: event.occurrenceId || null, title: event.title,
    calendarName: calendar.name || '', eventAt, dueAt: now,
  };
}

function calendarRecipients(calendar, members, actorUserId = null) {
  const ids = new Set([calendar.ownerUserId, ...members.map(member => member.userId)]
    .filter(Boolean).map(String));
  if (actorUserId != null) ids.delete(String(actorUserId));
  return [...ids];
}

function changeRecord(userId, calendar, kind, event, changeId, now) {
  return {
    _id: `${userId}:${kind}:${changeId}`, userId, kind, calendarId: calendar._id,
    calendarName: calendar.name || '', title: event?.title || '',
    eventId: event && kind !== 'event_deleted' ? event._id : null,
    eventAt: event && kind !== 'event_deleted' ? event.startsAt : null,
    occurrenceId: event?.isRecurring && kind !== 'event_deleted'
      ? `${event._id}@${new Date(event.startsAt).toISOString()}` : null,
    dueAt: now,
  };
}

module.exports = { CATCH_UP_MS, DEADLINE_LEAD_MS, dueReminders, reminderRecord, welcomeRecord,
  upcomingDeadlines, deadlineRecord, calendarRecipients, changeRecord };
