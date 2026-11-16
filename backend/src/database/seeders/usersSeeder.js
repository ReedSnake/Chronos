const bcrypt = require('bcryptjs');
const logger = require('../../config/logger');
const User = require('../../models/User');

const seedUsers = [
  { email: 'olena.koval@example.test', name: 'Olena Koval', country: 'UA' },
  { email: 'marco.rossi@example.test', name: 'Marco Rossi', country: 'IT' },
  { email: 'sofia.garcia@example.test', name: 'Sofia Garcia', country: 'ES' },
  { email: 'anna.mueller@example.test', name: 'Anna Mueller', country: 'DE' },
  { email: 'james.smith@example.test', name: 'James Smith', country: 'US' },
];

async function seedUsersCollection() {
  const passwordHash = await bcrypt.hash('ChronosSeedPassword!', 12);
  const operations = seedUsers.map((user) => ({
    updateOne: {
      filter: { email: user.email },
      update: {
        $setOnInsert: {
          ...user,
          passwordHash,
        },
      },
      upsert: true,
    },
  }));

  const result = await User.bulkWrite(operations, { ordered: true });
  logger.info({
    inserted: result.upsertedCount,
    existing: seedUsers.length - result.upsertedCount,
  }, 'Users seed completed');
}

module.exports = {
  seedUsersCollection,
};
