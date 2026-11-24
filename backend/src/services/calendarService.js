const Calendar = require('../models/Calendar');
const CalendarMember = require('../models/CalendarMember');
const CalendarShareLink = require('../models/CalendarShareLink');
const CalendarInvitation = require('../models/CalendarInvitation');
const Event = require('../models/Event');
const { ensurePersonalCalendars } = require('./personalCalendarService');
const AppError = require('../utils/AppError');
const { hasCalendarRole } = require('../constants/calendarRoles');

function calendarResponse(calendar, role) {
  return {
    id: String(calendar._id),
    name: calendar.name,
    description: calendar.description || '',
    color: calendar.color,
    isMain: Boolean(calendar.isMain),
    isHolidayCalendar: Boolean(calendar.isHolidayCalendar),
    countryCode: calendar.countryCode || null,
    timeZone: calendar.timeZone || 'UTC',
    defaultView: calendar.defaultView || 'month',
    isArchived: Boolean(calendar.isArchived),
    defaultEventDurationMinutes: calendar.defaultEventDurationMinutes || 60,
    role,
    isOwner: role === 'owner',
    createdAt: calendar.createdAt || null,
    updatedAt: calendar.updatedAt || null,
  };
}

async function createCalendar(ownerUserId, values) {
  if (values.isMain) throw new AppError('The main calendar is created automatically', 403, 'CALENDAR_MAIN_FORBIDDEN');
  try {
    const calendar = await Calendar.create({ ownerUserId, ...values });
    return calendarResponse(calendar, 'owner');
  } catch (error) {
    if (error?.code === 11000 && values.isMain) {
      throw new AppError('A main calendar already exists', 409, 'MAIN_CALENDAR_EXISTS');
    }
    throw error;
  }
}

async function listCalendars(userId) {
  await ensurePersonalCalendars(userId);
  const [ownedCalendars, memberships] = await Promise.all([
    Calendar.find({ ownerUserId: userId }).sort({ updatedAt: -1, _id: -1 }),
    CalendarMember.find({ userId }).select('calendarId role').lean(),
  ]);

  const memberRoleByCalendarId = new Map(
    memberships.map((member) => [String(member.calendarId), member.role]),
  );
  const sharedCalendarIds = [...memberRoleByCalendarId.keys()];
  const sharedCalendars = sharedCalendarIds.length
    ? await Calendar.find({
      _id: { $in: sharedCalendarIds },
      ownerUserId: { $ne: userId },
    }).sort({ updatedAt: -1, _id: -1 })
    : [];

  return [
    ...ownedCalendars.filter((calendar) => !calendar.isHolidayCalendar || calendar.countryCode).sort((a, b) => Number(Boolean(b.isMain)) - Number(Boolean(a.isMain))).map((calendar) => calendarResponse(calendar, 'owner')),
    ...sharedCalendars.filter((calendar) => !calendar.isHolidayCalendar).map((calendar) => calendarResponse(
      calendar,
      memberRoleByCalendarId.get(String(calendar._id)),
    )),
  ];
}

function calendarNotFound() {
  return new AppError('Calendar not found', 404, 'CALENDAR_NOT_FOUND');
}

async function getUserCalendarAccess(userId, calendarId, requiredRole = 'viewer') {
  const calendar = await Calendar.findById(calendarId);
  if (!calendar) throw calendarNotFound();
  if (calendar.isHolidayCalendar) {
    if (String(calendar.ownerUserId) !== String(userId)) throw calendarNotFound();
    if (requiredRole !== 'viewer') throw new AppError('National holidays are read-only', 403, 'HOLIDAY_CALENDAR_READ_ONLY');
  }
  if (String(calendar.ownerUserId) === String(userId)) {
    return { calendar, role: 'owner' };
  }
  const membership = await CalendarMember.findOne({ calendarId, userId });
  if (!membership || !hasCalendarRole(membership.role, requiredRole)) throw calendarNotFound();
  return { calendar, role: membership.role };
}

async function getCalendarForUser(userId, calendarId) {
  const { calendar, role } = await getUserCalendarAccess(userId, calendarId);
  return calendarResponse(calendar, role);
}

async function updateCalendarForUser(userId, calendarId, values) {
  const { calendar: existing, role } = await getUserCalendarAccess(userId, calendarId);
  if (existing.isHolidayCalendar) {
    if (role !== 'owner' || Object.keys(values).some((key) => key !== 'isArchived')) {
      throw new AppError('National holidays are read-only', 403, 'HOLIDAY_CALENDAR_READ_ONLY');
    }
  } else if (!hasCalendarRole(role, 'editor')) {
    throw calendarNotFound();
  }
  if ((Object.hasOwn(values, 'isMain') && values.isMain !== Boolean(existing.isMain))
      || (existing.isMain && values.isArchived)) {
    throw new AppError('The main calendar cannot be hidden or changed', 403, 'CALENDAR_MAIN_FORBIDDEN');
  }
  try {
    const calendar = await Calendar.findByIdAndUpdate(calendarId, { $set: values }, { new: true, runValidators: true });
    if (!calendar) throw calendarNotFound();
    return calendarResponse(calendar, role);
  } catch (error) {
    if (error?.code === 11000 && values.isMain) {
      throw new AppError('A main calendar already exists', 409, 'MAIN_CALENDAR_EXISTS');
    }
    throw error;
  }
}

async function removeCalendarData(calendarId) {
  await CalendarMember.deleteMany({ calendarId });
  await CalendarShareLink.deleteMany({ calendarId });
  await CalendarInvitation.deleteMany({ calendarId });
  await Event.deleteMany({ calendarId });
  const deleted = await Calendar.deleteOne({ _id: calendarId });
  if (!deleted.deletedCount) throw calendarNotFound();
}

async function deleteCalendarForUser(userId, calendarId) {
  const { calendar } = await getUserCalendarAccess(userId, calendarId, 'admin');
  if (calendar.isMain) throw new AppError('The main calendar cannot be deleted', 403, 'CALENDAR_MAIN_FORBIDDEN');
  await removeCalendarData(calendarId);
}

async function getCalendarForShareLink(link) {
  const calendar = await Calendar.findById(link.calendarId);
  if (!calendar || calendar.isHolidayCalendar) throw calendarNotFound();
  return calendarResponse(calendar, link.role);
}

async function updateCalendarForShareLink(link, values) {
  if (Object.hasOwn(values, 'isMain')) {
    throw new AppError('Share links cannot change the main calendar', 403, 'CALENDAR_MAIN_FORBIDDEN');
  }
  const existing = await Calendar.findById(link.calendarId);
  if (!existing) throw calendarNotFound();
  if (existing.isHolidayCalendar) throw new AppError('National holidays are read-only', 403, 'HOLIDAY_CALENDAR_READ_ONLY');
  if (existing.isMain && values.isArchived) throw new AppError('The main calendar cannot be hidden', 403, 'CALENDAR_MAIN_FORBIDDEN');
  const calendar = await Calendar.findByIdAndUpdate(
    link.calendarId,
    { $set: values },
    { new: true, runValidators: true },
  );
  if (!calendar || calendar.isHolidayCalendar) throw calendarNotFound();
  return calendarResponse(calendar, link.role);
}

async function claimCalendarMembership(userId, link) {
  const calendar = await Calendar.findById(link.calendarId);
  if (!calendar) throw calendarNotFound();
  if (calendar.isHolidayCalendar) throw new AppError('National holidays are read-only', 403, 'HOLIDAY_CALENDAR_READ_ONLY');
  if (String(calendar.ownerUserId) === String(userId)) return calendarResponse(calendar, 'owner');

  let membership = await CalendarMember.findOne({ calendarId: calendar._id, userId });
  if (!membership) {
    try {
      membership = await CalendarMember.create({
        calendarId: calendar._id,
        userId,
        role: link.role,
        addedByUserId: link.createdByUserId,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      membership = await CalendarMember.findOne({ calendarId: calendar._id, userId });
    }
  }
  return calendarResponse(calendar, membership.role);
}

module.exports = {
  calendarResponse,
  claimCalendarMembership,
  createCalendar,
  deleteCalendarForUser,
  getCalendarForShareLink,
  getCalendarForUser,
  getUserCalendarAccess,
  listCalendars,
  updateCalendarForShareLink,
  updateCalendarForUser,
};
