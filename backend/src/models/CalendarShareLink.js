const { Schema, model } = require('mongoose');

const calendarShareLinkSchema = new Schema({
  calendarId: {
    type: Schema.Types.ObjectId,
    ref: 'Calendar',
    required: true,
    immutable: true,
    index: true,
  },
  createdByUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true,
  },
  role: {
    type: String,
    enum: ['viewer', 'editor', 'admin'],
    required: true,
  },
  prefix: {
    type: String,
    required: true,
    unique: true,
    immutable: true,
    match: /^cs_[A-Za-z0-9_-]{12}$/,
  },
  tokenHash: {
    type: String,
    required: true,
    select: false,
    match: /^[a-f0-9]{64}$/,
  },
  status: {
    type: String,
    enum: ['active', 'revoked'],
    default: 'active',
  },
  expiresAt: { type: Date, default: null },
  lastUsedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
}, {
  collection: 'calendar_share_links',
  timestamps: true,
});

// Expired link data is eventually removed; authorization verifies expiry on every request.
calendarShareLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
calendarShareLinkSchema.index({ calendarId: 1, createdAt: -1 });

module.exports = model('CalendarShareLink', calendarShareLinkSchema);
