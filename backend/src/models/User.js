const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  passwordHash: {
    type: String,
    required: true,
    select: false,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 120,
  },
  country: {
    type: String,
    uppercase: true,
    trim: true,
    match: /^[A-Z]{2}$/,
  },
  bio: { type: String, trim: true, maxlength: 500, default: '' },
  avatarUpdatedAt: { type: Date, default: null },
  settings: {
    timeZone: { type: String, default: 'UTC' },
    weekStartsOn: { type: String, enum: ['monday', 'sunday'], default: 'monday' },
    timeFormat: { type: String, enum: ['12h', '24h'], default: '24h' },
  },
  emailVerifiedAt: { type: Date, default: null },
  welcomeNotificationEnabled: { type: Boolean, default: false },
  emailVerification: {
    tokenHash: { type: String, select: false, index: true, sparse: true },
    expiresAt: { type: Date },
    requestedAt: { type: Date },
  },
}, {
  collection: 'users',
  timestamps: true,
});

module.exports = model('User', userSchema);
