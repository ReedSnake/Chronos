const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, enum: ['welcome', 'reminder'], required: true },
  calendarId: { type: Schema.Types.ObjectId, ref: 'Calendar', default: null },
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', default: null },
  occurrenceId: { type: String, default: null },
  title: { type: String, default: '' },
  dueAt: { type: Date, required: true },
  readAt: { type: Date, default: null },
}, { collection: 'notifications', timestamps: true });
schema.index({ userId: 1, dueAt: -1 });
schema.index({ userId: 1, readAt: 1 });
module.exports = model('Notification', schema);
