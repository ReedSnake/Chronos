const { seedUsersCollection } = require('./usersSeeder');
const logger = require('../../config/logger');

async function seedDatabase() {
  logger.info('Database seed started');
  await seedUsersCollection();
  logger.info('Database seed completed');
}

module.exports = {
  seedDatabase,
};
