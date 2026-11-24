const { Schema, model } = require('mongoose');
const {
  EVENT_STATUSES,
  EVENT_STATUSES_BY_TYPE,
  EVENT_TYPES,
  RECURRENCE_INTERVALS,
} = require('../constants/eventTypes');

const attendeeSchema = new Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  inviteToken: {
    type: String,
    select: false,
    default: null,
  },
  expiresAt: { type: Date, default: null },
  invitationSentAt: { type: Date, default: null },
  lastInviteAttemptAt: { type: Date, default: null, select: false },
  inviteStatus: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending',
  },
}, { _id: false });

const eventSchema = new Schema({
  calendarId: {
    type: Schema.Types.ObjectId,
    ref: 'Calendar',
    required: true,
    immutable: true,
    index: true,
  },
  type: {
    type: String,
    enum: EVENT_TYPES,
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 200,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 4000,
    default: '',
  },
  color: {
    type: String,
    trim: true,
    uppercase: true,
    match: /^#[0-9A-F]{6}$/,
    default: '#3B82F6',
  },
  isRecurring: { type: Boolean, default: false },
  recurrenceInterval: {
    type: String,
    enum: RECURRENCE_INTERVALS,
    default: null,
  },
  recurrenceEndDate: { type: Date, default: null },
  startsAt: { type: Date, required: true, alias: 'startTime' },
  endsAt: { type: Date, default: null, alias: 'endTime' },
  locationUrl: { type: String, trim: true, maxlength: 2000, default: null },
  status: {
    type: String,
    enum: EVENT_STATUSES,
    default: null,
  },
  attendees: { type: [attendeeSchema], default: [] },
  categories: {
    type: [{ type: String, trim: true, lowercase: true, maxlength: 64 }],
    default: [],
  },
  deadline: { type: Date, default: null },
  subCategory: { type: String, trim: true, maxlength: 120, default: null },
  remindAt: { type: Date, default: null },
  date: { type: Date, default: null },
  internationalName: { type: String, trim: true, maxlength: 200, default: null },
}, {
  collection: 'events',
  optimisticConcurrency: true,
  timestamps: true,
});

eventSchema.index({ 'attendees.inviteToken': 1 });

function requireDate(event, field, message) {
  if (!event[field]) event.invalidate(field, message);
}

eventSchema.pre('validate', function validateTypeSpecificFields() {
  if (this.isRecurring && !this.recurrenceInterval) {
    this.invalidate('recurrenceInterval', 'A recurring event requires a recurrence interval');
  }
  if (!this.isRecurring) {
    this.recurrenceInterval = null;
    this.recurrenceEndDate = null;
  } else if (this.recurrenceEndDate && this.startsAt) {
    const dateOnlyEnd = this.recurrenceEndDate.toISOString().endsWith('T23:59:59.999Z');
    const earliest = this.startsAt.getTime() - (dateOnlyEnd ? 2 * 86400000 : 0);
    if (this.recurrenceEndDate.getTime() < earliest) {
      this.invalidate('recurrenceEndDate', 'Recurrence end must not precede the first event');
    }
  }

  if (this.type === 'arrangement') {
    requireDate(this, 'startsAt', 'An arrangement requires a start time');
    requireDate(this, 'endsAt', 'An arrangement requires an end time');
    if (!EVENT_STATUSES_BY_TYPE.arrangement.includes(this.status)) {
      this.invalidate('status', 'An arrangement must be scheduled or canceled');
    }
    if (this.startsAt && this.endsAt && this.endsAt <= this.startsAt) {
      this.invalidate('endsAt', 'An arrangement must end after it starts');
    }
  }

  if (this.type === 'task') {
    requireDate(this, 'deadline', 'A task requires a deadline');
    if (this.deadline) this.startsAt = this.deadline;
    if (!EVENT_STATUSES_BY_TYPE.task.includes(this.status)) {
      this.invalidate('status', 'A task must have a task status');
    }
  }

  if (this.type === 'reminder') {
    requireDate(this, 'remindAt', 'A reminder requires a reminder time');
    if (this.remindAt) this.startsAt = this.remindAt;
  }

  if (this.type === 'holiday') {
    requireDate(this, 'date', 'A holiday requires a date');
    if (this.date) this.startsAt = this.date;
    if (!this.internationalName) this.invalidate('internationalName', 'A holiday requires an international name');
  }

});

eventSchema.index({ calendarId: 1, startsAt: 1 });
eventSchema.index({ calendarId: 1, categories: 1, startsAt: 1 });

module.exports = model('Event', eventSchema);
