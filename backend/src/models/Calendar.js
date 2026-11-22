const { Schema, model } = require('mongoose');

const calendarSchema = new Schema({
  ownerUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 120,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: '',
  },
  color: {
    type: String,
    trim: true,
    uppercase: true,
    match: /^#[0-9A-F]{6}$/,
    default: '#3B82F6',
  },
  isMain: {
    type: Boolean,
    default: false,
  },
  countryCode: {
    type: String,
    trim: true,
    uppercase: true,
    match: /^[A-Z]{2}$/,
    default: null,
  },
  timeZone: {
    type: String,
    trim: true,
    default: 'UTC',
  },
  defaultView: {
    type: String,
    enum: ['month', 'agenda'],
    default: 'month',
  },
  isArchived: {
    type: Boolean,
    default: false,
    index: true,
  },
  defaultEventDurationMinutes: {
    type: Number,
    min: 5,
    max: 1440,
    default: 60,
  },
}, {
  collection: 'calendars',
  timestamps: true,
});

// A user can designate at most one personal calendar as their main calendar.
calendarSchema.index(
  { ownerUserId: 1 },
  { unique: true, partialFilterExpression: { isMain: true } },
);

calendarSchema.pre('validate', function validateTimeZone() {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: this.timeZone }).format();
  } catch {
    this.invalidate('timeZone', 'Calendar timeZone must be a valid IANA time zone');
  }
});

module.exports = model('Calendar', calendarSchema);
