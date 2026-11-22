const { Schema, model } = require('mongoose');
const { CALENDAR_ROLES } = require('../constants/calendarRoles');

const calendarInvitationSchema = new Schema({
  calendarId: {
    type: Schema.Types.ObjectId,
    ref: 'Calendar',
    required: true,
    immutable: true,
    index: true,
  },
  invitedByUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    index: true,
  },
  targetUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  role: {
    type: String,
    enum: CALENDAR_ROLES,
    required: true,
  },
  prefix: {
    type: String,
    required: true,
    unique: true,
    immutable: true,
    match: /^ci_[A-Za-z0-9_-]{12}$/,
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    select: false,
    match: /^[a-f0-9]{64}$/,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'revoked', 'expired'],
    required: true,
    default: 'pending',
  },
  expiresAt: { type: Date, required: true },
  respondedAt: { type: Date, default: null },
}, {
  collection: 'calendar_invitations',
  timestamps: true,
});

// Expiry is enforced during authorization; TTL only removes stale invitation records later.
calendarInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
calendarInvitationSchema.index({ calendarId: 1, status: 1, createdAt: -1 });
calendarInvitationSchema.index(
  { calendarId: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

module.exports = model('CalendarInvitation', calendarInvitationSchema);
