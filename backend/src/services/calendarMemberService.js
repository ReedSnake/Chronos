const User = require('../models/User');
const CalendarMember = require('../models/CalendarMember');
const CalendarInvitation = require('../models/CalendarInvitation');
const AppError = require('../utils/AppError');
const { getUserCalendarAccess } = require('./calendarService');

function memberResponse(member, user) {
  return {
    id: String(member._id),
    userId: String(member.userId?._id || member.userId),
    name: user?.name || null,
    email: user?.email || null,
    role: member.role,
    isOwner: false,
    addedAt: member.createdAt || null,
  };
}

function ownerResponse(calendar, owner) {
  return {
    id: null,
    userId: String(calendar.ownerUserId),
    name: owner?.name || null,
    email: owner?.email || null,
    role: 'owner',
    isOwner: true,
    addedAt: calendar.createdAt || null,
  };
}

async function listCalendarMembers(actorUserId, calendarId) {
  const { calendar } = await getUserCalendarAccess(actorUserId, calendarId, 'admin');
  const [owner, members] = await Promise.all([
    User.findById(calendar.ownerUserId).select('name email'),
    CalendarMember.find({ calendarId }).populate('userId', 'name email').sort({ createdAt: 1, _id: 1 }),
  ]);
  return [
    ownerResponse(calendar, owner),
    ...members.map((member) => memberResponse(member, member.userId)),
  ];
}

async function createCalendarMember(actorUserId, calendarId, { email, role }) {
  const { calendar } = await getUserCalendarAccess(actorUserId, calendarId, 'admin');
  const user = await User.findOne({ email, emailVerifiedAt: { $ne: null } }).select('name email');
  if (!user) {
    throw new AppError('A verified Chronos account is required. Send an email invitation instead.', 404, 'CALENDAR_MEMBER_USER_NOT_FOUND');
  }
  if (String(calendar.ownerUserId) === String(user._id)) {
    throw new AppError('The calendar owner is already a member', 409, 'CALENDAR_MEMBER_IS_OWNER');
  }
  const existing = await CalendarMember.findOne({ calendarId, userId: user._id });
  if (existing) throw new AppError('User is already a calendar member', 409, 'CALENDAR_MEMBER_EXISTS');

  try {
    const member = await CalendarMember.create({
      calendarId,
      userId: user._id,
      role,
      addedByUserId: actorUserId,
    });
    await CalendarInvitation.updateMany({
      calendarId,
      email,
      status: 'pending',
    }, {
      $set: { status: 'revoked', respondedAt: new Date() },
    });
    return memberResponse(member, user);
  } catch (error) {
    if (error?.code === 11000) throw new AppError('User is already a calendar member', 409, 'CALENDAR_MEMBER_EXISTS');
    throw error;
  }
}

async function updateCalendarMember(actorUserId, calendarId, memberId, { role }) {
  const { calendar } = await getUserCalendarAccess(actorUserId, calendarId, 'admin');
  const member = await CalendarMember.findOne({ _id: memberId, calendarId });
  if (!member) throw new AppError('Calendar member not found', 404, 'CALENDAR_MEMBER_NOT_FOUND');
  if (String(member.userId) === String(calendar.ownerUserId)) {
    throw new AppError('The calendar owner role cannot be changed', 403, 'CALENDAR_OWNER_ROLE_FORBIDDEN');
  }
  const updated = await CalendarMember.findByIdAndUpdate(
    memberId,
    { $set: { role } },
    { new: true, runValidators: true },
  );
  const user = await User.findById(updated.userId).select('name email');
  return memberResponse(updated, user);
}

async function removeCalendarMember(actorUserId, calendarId, memberId) {
  const { calendar } = await getUserCalendarAccess(actorUserId, calendarId, 'admin');
  const member = await CalendarMember.findOne({ _id: memberId, calendarId });
  if (!member) throw new AppError('Calendar member not found', 404, 'CALENDAR_MEMBER_NOT_FOUND');
  if (String(member.userId) === String(calendar.ownerUserId)) {
    throw new AppError('The calendar owner cannot be removed', 403, 'CALENDAR_OWNER_REMOVE_FORBIDDEN');
  }
  await CalendarMember.deleteOne({ _id: member._id });
}

module.exports = {
  createCalendarMember,
  listCalendarMembers,
  removeCalendarMember,
  updateCalendarMember,
};
