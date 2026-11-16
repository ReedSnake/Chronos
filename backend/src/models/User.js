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
    required: true,
    uppercase: true,
    trim: true,
    match: /^[A-Z]{2}$/,
  },
}, {
  collection: 'users',
  timestamps: true,
});

module.exports = model('User', userSchema);
