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
  emailVerifiedAt: { type: Date, default: null },
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
