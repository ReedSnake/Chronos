const User = require('../models/User');
const Avatar = require('../models/Avatar');
const AuthSession = require('../models/AuthSession');
const Calendar = require('../models/Calendar');
const CalendarMember = require('../models/CalendarMember');
const CalendarShareLink = require('../models/CalendarShareLink');
const CalendarInvitation = require('../models/CalendarInvitation');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const Integration = require('../models/Integration');
const ApiKey = require('../models/ApiKey');
const IntegrationAccessGrant = require('../models/IntegrationAccessGrant');
const PairingRequest = require('../models/PairingRequest');
const sessionService = require('./sessionService');
const { ensurePersonalCalendars } = require('./personalCalendarService');
const countryService = require('./countryService');
const AppError = require('../utils/AppError');

const DEFAULT_SETTINGS = Object.freeze({
  timeZone: 'UTC', weekStartsOn: 'monday', timeFormat: '24h',
});

function avatarUrl(user) {
  if (!user.avatarUpdatedAt) return null;
  return `/api/users/${user._id}/avatar?v=${new Date(user.avatarUpdatedAt).getTime()}`;
}

function ownProfile(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    bio: user.bio || '',
    country: user.country || null,
    avatarUrl: avatarUrl(user),
    createdAt: user.createdAt || null,
    settings: {
      timeZone: user.settings?.timeZone || DEFAULT_SETTINGS.timeZone,
      weekStartsOn: user.settings?.weekStartsOn || DEFAULT_SETTINGS.weekStartsOn,
      timeFormat: user.settings?.timeFormat || DEFAULT_SETTINGS.timeFormat,
    },
  };
}

function limitedProfile(user) {
  return {
    id: String(user._id),
    name: user.name,
    bio: user.bio || '',
    country: user.country || null,
    avatarUrl: avatarUrl(user),
    createdAt: user.createdAt || null,
  };
}

async function getPublicProfile(id) {
  const user = await User.findById(id);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  return limitedProfile(user);
}

async function updateProfile(userId, values) {
  return updateUser(userId, { $set: values });
}

async function updateCountry(userId, { country }) {
  if (country !== null) await countryService.ensureCountryIsAvailable(country);
  const profile = await updateUser(userId, country === null
    ? { $unset: { country: '' } } : { $set: { country } });
  // Refresh the system calendar immediately, including removal of a country.
  await ensurePersonalCalendars(userId);
  return profile;
}

async function updateSettings(userId, fields) {
  return updateUser(userId, { $set: fields });
}

async function updateUser(userId, update) {
  const user = await User.findByIdAndUpdate(userId, update, { new: true, runValidators: true });
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  return ownProfile(user);
}

const IMAGE_TYPES = Object.freeze({
  'image/jpeg': (bytes) => bytes.length >= 5 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9,
  'image/png': (bytes) => bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && bytes.toString('ascii', 12, 16) === 'IHDR',
  'image/webp': (bytes) => bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
});

async function setAvatar(userId, buffer, contentType) {
  const matchesType = IMAGE_TYPES[contentType];
  if (!matchesType) throw new AppError('Use JPEG, PNG or WebP', 415, 'UNSUPPORTED_IMAGE_TYPE');
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 2 * 1024 * 1024 || !matchesType(buffer)) {
    throw new AppError('Invalid image or image exceeds 2 MB', 400, 'INVALID_IMAGE');
  }
  await Avatar.findOneAndUpdate({ userId }, { $set: { data: buffer, contentType } }, { upsert: true, runValidators: true });
  return updateUser(userId, { $set: { avatarUpdatedAt: new Date() } });
}

async function getAvatar(userId) {
  const avatar = await Avatar.findOne({ userId });
  if (!avatar) throw new AppError('Avatar not found', 404, 'AVATAR_NOT_FOUND');
  return avatar;
}

async function removeAvatar(userId) {
  await Avatar.deleteOne({ userId });
  return updateUser(userId, { $set: { avatarUpdatedAt: null } });
}

async function removeCalendarData(userId, email) {
  const ownedCalendars = await Calendar.find({ ownerUserId: userId }).select('_id').lean();
  const ownedCalendarIds = ownedCalendars.map((calendar) => calendar._id);
  await CalendarMember.deleteMany({ userId });
  await CalendarMember.updateMany({ addedByUserId: userId }, { $set: { addedByUserId: null } });
  await CalendarShareLink.deleteMany({ createdByUserId: userId });
  await CalendarInvitation.deleteMany({ $or: [
    { invitedByUserId: userId }, { targetUserId: userId }, { email },
  ] });
  await Event.updateMany({ 'attendees.email': email }, { $pull: { attendees: { email } } });
  if (!ownedCalendarIds.length) return;
  await CalendarMember.deleteMany({ calendarId: { $in: ownedCalendarIds } });
  await CalendarShareLink.deleteMany({ calendarId: { $in: ownedCalendarIds } });
  await CalendarInvitation.deleteMany({ calendarId: { $in: ownedCalendarIds } });
  await Notification.deleteMany({ calendarId: { $in: ownedCalendarIds } });
  await Event.deleteMany({ calendarId: { $in: ownedCalendarIds } });
  await Calendar.deleteMany({ _id: { $in: ownedCalendarIds } });
}

async function removeIntegrationData(userId, email) {
  const ownedIntegrations = await Integration.find({ ownerUserId: userId }).select('_id').lean();
  const ownedIntegrationIds = ownedIntegrations.map((integration) => integration._id);
  const relatedAccess = ownedIntegrationIds.length
    ? { $or: [{ userId }, { integrationId: { $in: ownedIntegrationIds } }] }
    : { userId };
  const relatedRequests = { $or: [
    { targetUserId: userId }, { targetEmail: email },
    ...(ownedIntegrationIds.length ? [{ integrationId: { $in: ownedIntegrationIds } }] : []),
  ] };

  await ApiKey.deleteMany({ ownerUserId: userId });
  await PairingRequest.deleteMany(relatedRequests);
  await IntegrationAccessGrant.deleteMany(relatedAccess);
  await Integration.deleteMany({ ownerUserId: userId });
}

async function deleteAccount(userId, req, res) {
  const user = await User.findById(userId).select('email').lean();
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  await sessionService.revokeSession(req, res);
  await AuthSession.deleteMany({ userId });
  await Avatar.deleteOne({ userId });
  await Notification.deleteMany({ userId });
  await removeCalendarData(userId, user.email);
  await removeIntegrationData(userId, user.email);
  const deleted = await User.deleteOne({ _id: userId });
  if (!deleted.deletedCount) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
}

module.exports = {
  ownProfile, limitedProfile, getPublicProfile,
  updateProfile, updateCountry, updateSettings,
  setAvatar, getAvatar, removeAvatar, deleteAccount,
};
