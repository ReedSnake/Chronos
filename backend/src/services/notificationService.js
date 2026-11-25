const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Calendar = require('../models/Calendar');
const CalendarMember = require('../models/CalendarMember');
const Event = require('../models/Event');
const logger = require('../config/logger');
const { CATCH_UP_MS, dueReminders, reminderRecord, welcomeRecord } = require('./notificationModel');

async function insertOnce(record) {
  try {
    await Notification.updateOne({ _id: record._id }, { $setOnInsert: { ...record, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true, timestamps: false });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
}

async function ensureWelcome(user) {
  if (user.welcomeNotificationEnabled && user.emailVerifiedAt) await insertOnce(welcomeRecord(user));
}

async function accessFilter(userId) {
  const memberships = await CalendarMember.find({ userId }).select('calendarId').lean();
  const calendars = await Calendar.find({ $or: [{ ownerUserId: userId }, { _id: { $in: memberships.map(m => m.calendarId) } }] }).select('_id').lean();
  return { userId, $or: [{ kind: 'welcome' }, { calendarId: { $in: calendars.map(c => c._id) } }] };
}

async function list(user) {
  await ensureWelcome(user);
  const filter = await accessFilter(user._id);
  const [rows, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ readAt: 1, dueAt: -1, _id: -1 }).limit(100).lean(),
    Notification.countDocuments({ ...filter, readAt: null }),
  ]);
  return { notifications: rows.map(row => ({ id: row._id, kind: row.kind, title: row.title, calendarId: row.calendarId, eventId: row.eventId, occurrenceId: row.occurrenceId, dueAt: row.dueAt, readAt: row.readAt || null })), unreadCount };
}

async function markRead(userId, id) {
  const filter = await accessFilter(userId);
  await Notification.updateMany({ ...filter, readAt: null, ...(id ? { _id: id } : {}) }, { $set: { readAt: new Date() } });
}

async function generateDueReminders(from, to) {
  const query = { type: 'reminder', status: { $ne: 'canceled' }, startsAt: { $lte: to }, $or: [
    { isRecurring: { $ne: true }, startsAt: { $gte: from, $lte: to } },
    { isRecurring: true, $or: [{ recurrenceEndDate: null }, { recurrenceEndDate: { $gte: new Date(from.getTime() - 2 * 86400000) } }] },
  ] };
  // Process a bounded cursor rather than loading every event into memory.
  for await (const event of Event.find(query).lean().cursor()) {
    const calendar = await Calendar.findOne({ _id: event.calendarId, isArchived: { $ne: true } }).select('ownerUserId timeZone').lean();
    if (!calendar) continue;
    const due = dueReminders(event, from, to, calendar.timeZone || 'UTC');
    if (!due.length) continue;
    const members = await CalendarMember.find({ calendarId: calendar._id }).select('userId createdAt').lean();
    for (const occurrence of due) {
      const recipients = new Set([String(calendar.ownerUserId), ...members.filter(member => !member.createdAt || member.createdAt <= occurrence.startsAt).map(member => String(member.userId))]);
      for (const userId of recipients) await insertOnce(reminderRecord(userId, occurrence));
    }
  }
}

function startNotificationWorker() {
  let stopped = false;
  let timer;
  let running;
  let lastSuccessfulScan;
  const tick = async () => {
    if (stopped) return;
    try {
      if (mongoose.connection.readyState === 1) {
        const now = new Date();
        const from = new Date(Math.max(now.getTime() - CATCH_UP_MS, lastSuccessfulScan ? lastSuccessfulScan.getTime() - 120000 : 0));
        await generateDueReminders(from, now);
        lastSuccessfulScan = now;
      }
    } catch (error) {
      logger.warn({ code: error.code || 'NOTIFICATION_SCAN_FAILED' }, 'Reminder notification scan failed');
    } finally {
      if (!stopped) { timer = setTimeout(run, 30000); timer.unref(); }
    }
  };
  function run() { running = tick(); }
  run();
  return async () => { stopped = true; clearTimeout(timer); await running; };
}

module.exports = { ensureWelcome, list, markRead, generateDueReminders, startNotificationWorker };
