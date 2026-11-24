const { Schema, model } = require('mongoose');

const calendarSchema = new Schema({
  ownerUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true,
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
  isHolidayCalendar: { type: Boolean, default: false, immutable: true },
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

// The different compound key patterns avoid colliding with legacy indexes
// that used the same ownerUserId-only index name for different options.
calendarSchema.index({ ownerUserId: 1, updatedAt: -1 });
// One automatic main calendar per user.
calendarSchema.index(
  { ownerUserId: 1, isMain: 1 },
  { unique: true, partialFilterExpression: { isMain: true } },
);

calendarSchema.index(
  { ownerUserId: 1, isHolidayCalendar: 1 },
  { unique: true, partialFilterExpression: { isHolidayCalendar: true } },
);

calendarSchema.pre('validate', function validateTimeZone() {
  if (this.isMain && (this.isArchived || this.isHolidayCalendar)) {
    this.invalidate('isMain', 'The main calendar must be visible and personal');
  }
  try {
    Intl.DateTimeFormat('en-US', { timeZone: this.timeZone }).format();
  } catch {
    this.invalidate('timeZone', 'Calendar timeZone must be a valid IANA time zone');
  }
});

module.exports = model('Calendar', calendarSchema);
