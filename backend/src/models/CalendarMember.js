const { Schema, model } = require('mongoose');

const calendarMemberSchema = new Schema({
  calendarId: {
    type: Schema.Types.ObjectId,
    ref: 'Calendar',
    required: true,
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  role: {
    type: String,
    enum: ['viewer', 'editor', 'admin'],
    required: true,
  },
  addedByUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  collection: 'calendar_members',
  timestamps: true,
});

calendarMemberSchema.index({ calendarId: 1, userId: 1 }, { unique: true });

module.exports = model('CalendarMember', calendarMemberSchema);
