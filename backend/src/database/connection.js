const mongoose = require('mongoose');
const config = require('../config/config');
const logger = require('../config/logger');

let connectionPromise;
let reconnectTimer;
let isClosing = false;

mongoose.set('strictQuery', true);

function getDatabaseStatus() {
  const readyState = mongoose.connection.readyState;

  return {
    status: mongoose.STATES[readyState] || 'unknown',
    readyState,
  };
}

function scheduleReconnect() {
  if (isClosing || reconnectTimer || mongoose.connection.readyState === 1) {
    return;
  }

  const delay = config.database.connectRetryDelayMS;
  logger.warn({ delay }, 'MongoDB reconnection scheduled');

  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    connectDatabase().catch(() => {
      // The failed attempt schedules the next retry. Keep HTTP available meanwhile.
    });
  }, delay);
  reconnectTimer.unref();
}

function connectDatabase({ retry = true } = {}) {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose.connection);
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  isClosing = false;
  logger.info('MongoDB connection attempt started');

  const connectionOptions = {
    dbName: config.database.databaseName,
    maxPoolSize: config.database.maxPoolSize,
    serverSelectionTimeoutMS: config.database.serverSelectionTimeoutMS,
    ...(config.database.username ? {
      user: config.database.username,
      pass: config.database.password,
      authSource: config.database.authSource,
    } : {}),
  };

  connectionPromise = mongoose.connect(config.database.uri, connectionOptions)
    .then(() => {
      logger.info({ database: mongoose.connection.name }, 'MongoDB connection established');
      return mongoose.connection;
    })
    .catch((error) => {
      logger.error({ err: error }, 'MongoDB connection attempt failed');
      if (retry) {
        scheduleReconnect();
      }
      throw error;
    })
    .finally(() => {
      connectionPromise = undefined;
    });

  return connectionPromise;
}

async function closeDatabase() {
  isClosing = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }

  if (mongoose.connection.readyState === 0) {
    return;
  }

  logger.info('MongoDB disconnection started');
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}

mongoose.connection.on('connected', () => {
  logger.info({ database: mongoose.connection.name }, 'MongoDB status changed to connected');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB status changed to disconnected');
  scheduleReconnect();
});

mongoose.connection.on('error', (error) => {
  logger.error({ err: error }, 'MongoDB connection emitted an error');
});

module.exports = {
  closeDatabase,
  connectDatabase,
  getDatabaseStatus,
};
