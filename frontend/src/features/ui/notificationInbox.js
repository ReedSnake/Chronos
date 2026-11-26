import { eventDayKey } from '../events/eventForm.js';
import { shiftDate } from '../tasks/taskBoardModel.js';

export function groupNotifications(notifications, filter, now, zone) {
  const today = eventDayKey({ startsAt: now }, zone);
  const yesterday = shiftDate(today, -1);
  const groups = { today: [], yesterday: [], earlier: [] };
  const sorted = [...notifications].sort((a, b) => Date.parse(b.dueAt) - Date.parse(a.dueAt));
  const seen = new Set();
  for (const item of sorted) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    if (filter === 'unread' && item.readAt || filter === 'read' && !item.readAt) continue;
    const day = eventDayKey({ startsAt: item.dueAt }, zone);
    groups[day >= today ? 'today' : day === yesterday ? 'yesterday' : 'earlier'].push(item);
  }
  return Object.entries(groups).map(([key, items]) => ({ key, items })).filter(group => group.items.length);
}

function reminderKey(calendarId, eventId, dueAt) {
  return JSON.stringify([calendarId, eventId, new Date(dueAt).getTime()]);
}

// A scheduled reminder becomes an inbox notification when it is due. Never
// display the same occurrence in both lists, even if the browser clock lags.
export function upcomingReminders(events, notifications, now) {
  const seen = new Set(notifications.filter(n => n.kind === 'reminder').map(n => reminderKey(n.calendarId, n.eventId, n.dueAt)));
  return events.filter(event => {
    const due = Date.parse(event.remindAt || event.startsAt);
    if (event.type !== 'reminder' || event.status === 'canceled' || !(due > now.getTime())) return false;
    const key = reminderKey(event.calendarId, event.id, due);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => Date.parse(a.remindAt || a.startsAt) - Date.parse(b.remindAt || b.startsAt));
}
