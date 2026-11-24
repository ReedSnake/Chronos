const { randomBytes, createHash } = require('node:crypto');
const Event = require('../models/Event');
const AppError = require('../utils/AppError');
const { getUserCalendarAccess } = require('./calendarService');
const { ensureMailConfigured, sendEventInvitationEmail } = require('../config/mail');
const { enqueueEmailDelivery } = require('./emailDeliveryQueue');

const EXPIRY = 7 * 86400000;
const COOLDOWN = 60000;
const buckets = new Map();
function reserve(userId) {
  const now = Date.now();
  if (buckets.size >= 5000) for (const [key, value] of buckets) if (value.until <= now) buckets.delete(key);
  const key = String(userId);
  const existing = buckets.get(key);
  const value = existing?.until > now ? existing : { count: 0, until: now + 15 * 60000 };
  if (value.count >= 50 || (!existing && buckets.size >= 5000)) throw new AppError('Too many invitations', 429, 'RATE_LIMITED');
  value.count += 1;
  buckets.set(key, value);
}
function hash(token) { return createHash('sha256').update(token).digest('hex'); }
function invalid() { return new AppError('Invitation is invalid, expired or already answered', 400, 'EVENT_INVITATION_INVALID'); }
function tokenHash(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw invalid();
  return hash(token);
}
function recipientEmail(value) {
  if (typeof value !== 'string') throw new AppError('Invalid email', 400, 'VALIDATION_ERROR');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('Invalid email', 400, 'VALIDATION_ERROR');
  return email;
}

async function sendInvitation(userId, calendarId, eventId, recipient, locale) {
  const { calendar } = await getUserCalendarAccess(userId, calendarId, 'editor');
  const email = recipientEmail(recipient);
  ensureMailConfigured();
  reserve(userId);
  const now = new Date();
  const token = randomBytes(32).toString('hex');
  const digest = hash(token);
  const expiresAt = new Date(now.getTime() + EXPIRY);
  const event = await Event.findOneAndUpdate({ _id: eventId, calendarId, attendees: { $elemMatch: {
    email, inviteStatus: 'pending', $or: [{ lastInviteAttemptAt: null }, { lastInviteAttemptAt: { $lte: new Date(now.getTime() - COOLDOWN) } }],
  } } }, { $set: { 'attendees.$.inviteToken': digest, 'attendees.$.expiresAt': expiresAt,
    'attendees.$.lastInviteAttemptAt': now, 'attendees.$.invitationSentAt': null }, $inc: { __v: 1 } }, { new: true });
  if (!event) throw new AppError('Event attendee is missing, already answered or recently invited', 409, 'EVENT_INVITATION_NOT_SENDABLE');
  const current = { _id: eventId, calendarId, attendees: { $elemMatch: { email, inviteToken: digest, inviteStatus: 'pending' } } };
  try {
    await enqueueEmailDelivery(async () => {
      if (!await Event.exists(current)) throw invalid();
      await sendEventInvitationEmail(email, { token, title: event.title, startsAt: event.startsAt, type: event.type, isRecurring: event.isRecurring, timeZone: event.type === 'holiday' ? 'UTC' : calendar.timeZone }, locale);
    });
  } catch {
    await Event.updateOne(current, { $set: { 'attendees.$.inviteToken': null, 'attendees.$.expiresAt': null }, $inc: { __v: 1 } });
    throw new AppError('Unable to deliver event invitation', 503, 'EMAIL_DELIVERY_FAILED');
  }
  await Event.updateOne(current, { $set: { 'attendees.$.invitationSentAt': new Date() }, $inc: { __v: 1 } });
  return { messageCode: 'EVENT_INVITATION_SENT' };
}

function activeFilter(token) {
  return { attendees: { $elemMatch: { inviteToken: tokenHash(token), inviteStatus: 'pending', expiresAt: { $gt: new Date() } } } };
}
async function previewInvitation(token) {
  const event = await Event.findOne(activeFilter(token)).select('title type startsAt endsAt isRecurring').lean();
  if (!event) throw invalid();
  return { title: event.title, type: event.type, startsAt: event.startsAt, endsAt: event.endsAt, isRecurring: event.isRecurring };
}
async function respondInvitation(token, response) {
  if (!['accepted', 'declined'].includes(response)) throw new AppError('Invalid invitation response', 400, 'VALIDATION_ERROR');
  const result = await Event.updateOne(activeFilter(token), { $set: { 'attendees.$.inviteStatus': response,
    'attendees.$.inviteToken': null, 'attendees.$.expiresAt': null }, $inc: { __v: 1 } });
  if (!result.modifiedCount) throw invalid();
  return { status: response };
}
module.exports = { sendInvitation, previewInvitation, respondInvitation };
