export const CALENDAR_VIEWS = Object.freeze(['overview', 'day', 'week', 'month', 'year', 'agenda']);
export const DEFAULT_CALENDAR_VIEW = 'month';

const preferenceKey = (userId) => `chronos.calendarView.${userId}`;

export function readCalendarView(userId) {
  if (!userId) return DEFAULT_CALENDAR_VIEW;
  try {
    const view = globalThis.localStorage.getItem(preferenceKey(userId));
    return CALENDAR_VIEWS.includes(view) ? view : DEFAULT_CALENDAR_VIEW;
  } catch {
    return DEFAULT_CALENDAR_VIEW;
  }
}

export function saveCalendarView(userId, view) {
  if (!userId || !CALENDAR_VIEWS.includes(view)) return;
  try {
    globalThis.localStorage.setItem(preferenceKey(userId), view);
  } catch {
    // Storage may be disabled; switching views still works for this session.
  }
}
