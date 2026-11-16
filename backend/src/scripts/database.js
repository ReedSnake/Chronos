const logger = require('../config/logger');
const { closeDatabase } = require('../database/connection');
const {
  dropDatabase,
  initializeDatabase,
  resetDatabase,
  seedOnlyDatabase,
} = require('../database/lifecycle');

const commands = {
  init: initializeDatabase,
  seed: seedOnlyDatabase,
  reset: resetDatabase,
  drop: dropDatabase,
};

async function run() {
  const command = process.argv[2];
  const action = commands[command];

  if (!action) {
    logger.error({ command }, 'Unknown database command. Use init, seed, reset, or drop');
    process.exitCode = 1;
    return;
  }

  try {
    logger.info({ command }, 'Database command started');
    await action();
    logger.info({ command }, 'Database command completed');
  } catch (error) {
    logger.error({ err: error, command }, 'Database command failed');
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

run();
