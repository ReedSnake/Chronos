const mongoose = require('mongoose');
const logger = require('../config/logger');
const { connectDatabase } = require('./connection');
const User = require('../models/User');
const AuthSession = require('../models/AuthSession');
const Avatar = require('../models/Avatar');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const Calendar = require('../models/Calendar');
const CalendarMember = require('../models/CalendarMember');
const Integration = require('../models/Integration');
const ApiKey = require('../models/ApiKey');
const IntegrationAccessGrant = require('../models/IntegrationAccessGrant');
const PairingRequest = require('../models/PairingRequest');
const CalendarShareLink = require('../models/CalendarShareLink');
const CalendarInvitation = require('../models/CalendarInvitation');
const { seedDatabase } = require('./seeders');

async function initializeDatabase({ seed = true } = {}) {
  await connectDatabase({ retry: false });
  await User.createIndexes();
  await AuthSession.createIndexes();
  await Avatar.createIndexes();
  await Calendar.createIndexes();
  await Event.createIndexes();
  await Notification.createIndexes();
  await CalendarMember.createIndexes();
  await Integration.createIndexes();
  await ApiKey.createIndexes();
  await IntegrationAccessGrant.createIndexes();
  await PairingRequest.createIndexes();
  await CalendarShareLink.createIndexes();
  await CalendarInvitation.createIndexes();
  logger.info('Database indexes initialized');
  if (seed) {
    await seedDatabase();
  }
  logger.info({ seeded: seed }, 'Database initialization completed');
}

async function seedOnlyDatabase() {
  await initializeDatabase({ seed: false });
  await seedDatabase();
}

async function dropDatabase() {
  await connectDatabase({ retry: false });
  logger.warn({ database: mongoose.connection.name }, 'Database drop started');
  await mongoose.connection.dropDatabase();
  logger.warn({ database: mongoose.connection.name }, 'Database drop completed');
}

async function resetDatabase() {
  await dropDatabase();
  await initializeDatabase({ seed: true });
  logger.info('Database reset completed');
}

module.exports = {
  dropDatabase,
  initializeDatabase,
  resetDatabase,
  seedOnlyDatabase,
};
