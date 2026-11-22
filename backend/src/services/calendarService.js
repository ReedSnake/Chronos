const Calendar = require('../models/Calendar');
const CalendarMember = require('../models/CalendarMember');
const CalendarShareLink = require('../models/CalendarShareLink');
const CalendarInvitation = require('../models/CalendarInvitation');
const Event = require('../models/Event');
const AppError = require('../utils/AppError');
const { hasCalendarRole } = require('../constants/calendarRoles');

function calendarResponse(calendar, role) {
  return {
    id: String(calendar._id),
    name: calendar.name,
    description: calendar.description || '',
    color: calendar.color,
    isMain: calendar.isMain,
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
    ...ownedCalendars.map((calendar) => calendarResponse(calendar, 'owner')),
    ...sharedCalendars.map((calendar) => calendarResponse(
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
  const { role } = await getUserCalendarAccess(userId, calendarId, 'editor');
  if (Object.hasOwn(values, 'isMain') && role !== 'owner') {
    throw new AppError('Only the calendar owner can change its main status', 403, 'CALENDAR_MAIN_FORBIDDEN');
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
  await getUserCalendarAccess(userId, calendarId, 'admin');
  await removeCalendarData(calendarId);
}

async function getCalendarForShareLink(link) {
  const calendar = await Calendar.findById(link.calendarId);
  if (!calendar) throw calendarNotFound();
  return calendarResponse(calendar, link.role);
}

async function updateCalendarForShareLink(link, values) {
  if (Object.hasOwn(values, 'isMain')) {
    throw new AppError('Share links cannot change the main calendar', 403, 'CALENDAR_MAIN_FORBIDDEN');
  }
  const calendar = await Calendar.findByIdAndUpdate(
    link.calendarId,
    { $set: values },
    { new: true, runValidators: true },
  );
  if (!calendar) throw calendarNotFound();
  return calendarResponse(calendar, link.role);
}

async function claimCalendarMembership(userId, link) {
  const calendar = await Calendar.findById(link.calendarId);
  if (!calendar) throw calendarNotFound();
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
