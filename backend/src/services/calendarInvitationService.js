const config = require('../config/config');
const logger = require('../config/logger');
const Calendar = require('../models/Calendar');
const CalendarInvitation = require('../models/CalendarInvitation');
const CalendarMember = require('../models/CalendarMember');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { ensureMailConfigured, sendCalendarInvitationEmail } = require('../config/mail');
const { enqueueEmailDelivery } = require('./emailDeliveryQueue');
const {
  createCalendarInvitationToken,
  matchesCalendarInvitationToken,
  parseCalendarInvitationToken,
} = require('../utils/calendarInvitation');
const { claimCalendarMembership, getUserCalendarAccess } = require('./calendarService');

const PENDING_INVITATION_COOKIE = 'chronos_pending_calendar_invitation';
const INVITATION_RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_INVITATIONS_PER_WINDOW = 100;
const invitationRateBuckets = new Map();
const processStartedAt = new Date();

function invitationResponse(invitation) {
  return {
    id: String(invitation._id),
    email: invitation.email,
    role: invitation.role,
    prefix: invitation.prefix,
    status: invitation.status,
    deliveryStatus: invitation.deliveryStatus || 'sent',
    expiresAt: invitation.expiresAt,
    respondedAt: invitation.respondedAt || null,
    createdAt: invitation.createdAt || null,
  };
}

function createInvitationUrl(rawToken) {
  const url = new URL('/calendar-invite', config.mail.frontendUrl);
  url.hash = `token=${encodeURIComponent(rawToken)}`;
  return url.toString();
}

function cookieOptions(req, maxAge) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.auth.secureCookies || req.secure,
    path: '/api',
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}

function readCookie(req) {
  const item = (req.headers?.cookie || '').split(';')
    .find((entry) => entry.trim().startsWith(`${PENDING_INVITATION_COOKIE}=`));
  return item ? item.trim().slice(PENDING_INVITATION_COOKIE.length + 1) : null;
}

function reserveInvitationRateLimit(userId, calendarId, count) {
  const now = Date.now();
  if (invitationRateBuckets.size > 5000) {
    for (const [key, record] of invitationRateBuckets) {
      if (record.resetAt <= now) invitationRateBuckets.delete(key);
    }
  }
  const key = `${userId}:${calendarId}`;
  const existing = invitationRateBuckets.get(key);
  const record = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + INVITATION_RATE_WINDOW_MS }
    : existing;
  if (record.count + count > MAX_INVITATIONS_PER_WINDOW) {
    throw new AppError('Too many calendar invitations. Try again later.', 429, 'CALENDAR_INVITATION_RATE_LIMITED');
  }
  record.count += count;
  invitationRateBuckets.set(key, record);
}

async function createPendingInvitation(calendarId, userId, { email, role, expiresInMinutes }, deliveryStatus = 'sent') {
  const generated = createCalendarInvitationToken();
  const invitation = await CalendarInvitation.create({
    calendarId,
    invitedByUserId: userId,
    email,
    role,
    deliveryStatus,
    prefix: generated.prefix,
    tokenHash: generated.tokenHash,
    expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000),
  });
  return { invitation, rawToken: generated.rawToken, tokenHash: generated.tokenHash };
}

async function expirePendingInvitation(calendarId, email) {
  const now = new Date();
  await CalendarInvitation.updateMany({
    calendarId,
    email,
    status: 'pending',
    expiresAt: { $lte: now },
  }, {
    $set: { status: 'expired', respondedAt: now },
  });
}

async function assertInvitationCanBeCreated(calendarId, email) {
  await expirePendingInvitation(calendarId, email);
  if (await recipientAlreadyHasMembership(calendarId, email)) {
    throw new AppError('User is already a calendar member', 409, 'CALENDAR_INVITATION_MEMBER_EXISTS');
  }
  if (await CalendarInvitation.exists({ calendarId, email, status: 'pending' })) {
    throw new AppError('A pending invitation already exists for this email', 409, 'CALENDAR_INVITATION_ALREADY_PENDING');
  }
}

async function deliverInvitation(invitation, rawToken, tokenHash, calendarName, locale) {
  try {
    await enqueueEmailDelivery(() => sendCalendarInvitationEmail(invitation.email, {
      token: rawToken,
      calendarName,
      role: invitation.role,
    }, locale));
  } catch (error) {
    await CalendarInvitation.deleteOne({ _id: invitation._id, tokenHash });
    throw error;
  }
}

async function createCalendarInvitation(userId, calendarId, values, locale = 'en') {
  const { calendar } = await getUserCalendarAccess(userId, calendarId, 'admin');
  ensureMailConfigured();
  await assertInvitationCanBeCreated(calendarId, values.email);
  reserveInvitationRateLimit(userId, calendarId, 1);
  let prepared;
  try {
    prepared = await createPendingInvitation(calendarId, userId, values);
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('A pending invitation already exists for this email', 409, 'CALENDAR_INVITATION_ALREADY_PENDING');
    }
    throw error;
  }
  const { invitation, rawToken, tokenHash } = prepared;
  await deliverInvitation(invitation, rawToken, tokenHash, calendar.name, locale);
  return {
    invitation: invitationResponse(invitation),
    invitationUrl: createInvitationUrl(rawToken),
  };
}

async function recipientAlreadyHasMembership(calendarId, email) {
  const user = await User.findOne({ email }).select('_id');
  if (!user) return false;
  return Boolean(await CalendarMember.exists({ calendarId, userId: user._id }));
}

function queueBulkInvitationDelivery(prepared, calendarName, locale, expiresInMinutes) {
  const { invitation, rawToken } = prepared;
  // SMTP happens after the response is built. Only active, queued invitations are sent.
  void enqueueEmailDelivery(async () => {
    const active = await CalendarInvitation.exists({
      _id: invitation._id, status: 'pending', deliveryStatus: 'queued',
    });
    if (!active) return false;
    await sendCalendarInvitationEmail(invitation.email, {
      token: rawToken, calendarName, role: invitation.role,
    }, locale);
    return true;
  }).then(
    async (sent) => {
      if (!sent) {
        await CalendarInvitation.updateOne({ _id: invitation._id, status: 'pending', deliveryStatus: 'queued' }, {
          $set: { deliveryStatus: 'failed', status: 'expired', respondedAt: new Date() },
        }).catch((error) => logger.error({ err: error }, 'Unable to finalize unsent calendar invitation'));
        return;
      }
      try {
        await CalendarInvitation.updateOne({ _id: invitation._id, deliveryStatus: 'queued' }, {
          $set: { deliveryStatus: 'sent', expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000) },
        });
      } catch (error) {
        logger.error({ err: error, invitationId: String(invitation._id) }, 'Unable to record calendar invitation delivery');
      }
    },
    async (error) => {
      logger.warn({ err: error, invitationId: String(invitation._id) }, 'Bulk calendar invitation email failed');
      try {
        // Keep a failure record, but revoke the token and free the email for retry.
        await CalendarInvitation.updateOne({ _id: invitation._id, deliveryStatus: 'queued' }, {
          $set: { deliveryStatus: 'failed', status: 'revoked', respondedAt: new Date() },
        });
      } catch (updateError) {
        logger.error({ err: updateError, invitationId: String(invitation._id) }, 'Unable to record failed calendar invitation');
      }
    },
  );
}

async function failInterruptedBulkDeliveries(calendarId) {
  // Raw invitation tokens only live in the current process's SMTP queue.
  // After a restart, mark orphaned queued records as failed so users can retry.
  await CalendarInvitation.updateMany({
    calendarId,
    status: 'pending',
    deliveryStatus: 'queued',
    createdAt: { $lt: processStartedAt },
  }, {
    $set: { status: 'revoked', deliveryStatus: 'failed', respondedAt: new Date() },
  });
}

async function createBulkCalendarInvitations(userId, calendarId, { emails, role, expiresInMinutes }, locale = 'en') {
  const { calendar } = await getUserCalendarAccess(userId, calendarId, 'admin');
  ensureMailConfigured();
  await failInterruptedBulkDeliveries(calendarId);

  const results = new Array(emails.length);
  const seen = new Set();
  const candidates = [];
  for (const [index, email] of emails.entries()) {
    if (seen.has(email)) {
      results[index] = { email, status: 'duplicate' };
    } else {
      seen.add(email);
      candidates.push({ index, email });
    }
  }

  // Check independent recipients in parallel instead of waiting on 50 serial DB lookups.
  const eligible = await Promise.all(candidates.map(async ({ index, email }) => {
    await expirePendingInvitation(calendarId, email);
    if (await recipientAlreadyHasMembership(calendarId, email)) {
      results[index] = { email, status: 'already_member' };
      return null;
    }
    if (await CalendarInvitation.exists({ calendarId, email, status: 'pending' })) {
      results[index] = { email, status: 'already_pending' };
      return null;
    }
    return { index, email };
  }));
  const pending = eligible.filter(Boolean);
  reserveInvitationRateLimit(userId, calendarId, pending.length);

  const deliveries = await Promise.all(pending.map(async ({ index, email }) => {
    try {
      const prepared = await createPendingInvitation(
        calendarId, userId, { email, role, expiresInMinutes }, 'queued',
      );
      results[index] = {
        email, status: 'queued', invitation: invitationResponse(prepared.invitation),
      };
      return prepared;
    } catch (error) {
      if (error?.code === 11000) {
        results[index] = { email, status: 'already_pending' };
        return null;
      }
      // A partial DB error must not leave created invites unsent and untracked.
      results[index] = { email, status: 'failed' };
      logger.error({ err: error }, 'Unable to create bulk calendar invitation');
      return null;
    }
  }));

  for (const prepared of deliveries) {
    if (prepared) queueBulkInvitationDelivery(prepared, calendar.name, locale, expiresInMinutes);
  }
  return { results };
}

async function listCalendarInvitations(userId, calendarId) {
  await getUserCalendarAccess(userId, calendarId, 'admin');
  await failInterruptedBulkDeliveries(calendarId);
  const invitations = await CalendarInvitation.find({ calendarId }).sort({ createdAt: -1, _id: -1 });
  return invitations.map(invitationResponse);
}

async function revokeCalendarInvitation(userId, calendarId, invitationId) {
  await getUserCalendarAccess(userId, calendarId, 'admin');
  const invitation = await CalendarInvitation.findOneAndUpdate({
    _id: invitationId,
    calendarId,
    status: 'pending',
  }, { $set: { status: 'revoked', respondedAt: new Date() } }, { new: true });
  if (!invitation) throw new AppError('Calendar invitation not found', 404, 'CALENDAR_INVITATION_NOT_FOUND');
}

async function findActiveInvitation(rawToken) {
  const supplied = parseCalendarInvitationToken(rawToken);
  if (!supplied) return null;
  const invitation = await CalendarInvitation.findOne({ prefix: supplied.prefix }).select('+tokenHash');
  if (!invitation || invitation.status !== 'pending' || invitation.expiresAt <= new Date()
    || !matchesCalendarInvitationToken(supplied.token, invitation.tokenHash)) {
    return null;
  }
  return invitation;
}

async function rememberCalendarInvitation(req, res, rawToken) {
  const invitation = await findActiveInvitation(rawToken);
  if (!invitation) throw new AppError('Calendar invitation link is invalid or has expired', 400, 'INVALID_CALENDAR_INVITATION');
  res.cookie(
    PENDING_INVITATION_COOKIE,
    rawToken,
    cookieOptions(req, Math.max(0, new Date(invitation.expiresAt).getTime() - Date.now())),
  );
}

function clearPendingCalendarInvitation(req, res) {
  res.clearCookie(PENDING_INVITATION_COOKIE, cookieOptions(req));
}

async function claimPendingCalendarInvitation(req, res, user) {
  const rawToken = readCookie(req);
  if (!rawToken) return null;
  try {
    const invitation = await findActiveInvitation(rawToken);
    if (!invitation || invitation.email !== user.email) return null;
    const calendar = await Calendar.findById(invitation.calendarId);
    if (!calendar) return null;
    const claimed = await claimCalendarMembership(user._id, {
      calendarId: invitation.calendarId,
      role: invitation.role,
      createdByUserId: invitation.invitedByUserId,
    });
    await CalendarInvitation.updateOne({
      _id: invitation._id,
      status: 'pending',
    }, {
      $set: { status: 'accepted', targetUserId: user._id, respondedAt: new Date() },
    });
    return claimed;
  } finally {
    clearPendingCalendarInvitation(req, res);
  }
}

module.exports = {
  claimPendingCalendarInvitation,
  clearPendingCalendarInvitation,
  createBulkCalendarInvitations,
  createCalendarInvitation,
  findActiveInvitation,
  listCalendarInvitations,
  rememberCalendarInvitation,
  revokeCalendarInvitation,
};
