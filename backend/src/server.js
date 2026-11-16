const app = require('./app');
const mongoose = require('mongoose');
const config = require('./config/config');
const logger = require('./config/logger');
const { closeDatabase, connectDatabase } = require('./database/connection');
const { initializeDatabase } = require('./database/lifecycle');

let isShuttingDown = false;
let databaseInitializationPromise;

function initializeConnectedDatabase() {
  if (!config.database.autoInitialize) {
    return Promise.resolve();
  }

  if (databaseInitializationPromise) {
    return databaseInitializationPromise;
  }

  databaseInitializationPromise = initializeDatabase()
    .catch((error) => {
      logger.error({ err: error }, 'Database initialization after connection failed');
    })
    .finally(() => {
      databaseInitializationPromise = undefined;
    });

  return databaseInitializationPromise;
}

mongoose.connection.on('connected', () => {
  initializeConnectedDatabase();
});

function startServer() {
  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, config.host);

    const onStartupError = (error) => {
      logger.fatal({ err: error, port: config.port }, 'Server startup failed');
      reject(error);
    };

    server.once('error', onStartupError);
    server.once('listening', () => {
      server.removeListener('error', onStartupError);
      server.on('error', (error) => {
        logger.error({ err: error }, 'HTTP server emitted an error');
      });

      logger.info({ host: config.host, port: config.port }, 'HTTP server started');
      logger.info({ url: `${config.documentation.serverUrl}/api-docs` }, 'API documentation is available');
      logger.info('Deployment stage: backend is connecting to MongoDB');

      connectDatabase()
        .then(initializeConnectedDatabase)
        .catch(() => {
          logger.warn('HTTP server remains available while MongoDB reconnects');
        });

      resolve(server);
    });
  });
}

function closeHttpServer(server) {
  if (!server.listening) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function gracefulShutdown(server, signal, exitCode = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.warn({ signal }, 'Graceful shutdown started');

  try {
    await closeHttpServer(server);
    await closeDatabase();
    logger.info('Graceful shutdown completed');
  } catch (error) {
    logger.error({ err: error }, 'Graceful shutdown failed');
    exitCode = 1;
  } finally {
    process.exitCode = exitCode;
  }
}

function registerProcessHandlers(server) {
  const shutdown = (signal) => {
    gracefulShutdown(server, signal);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
  });
  process.once('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    gracefulShutdown(server, 'uncaughtException', 1);
  });
}

if (require.main === module) {
  startServer()
    .then(registerProcessHandlers)
    .catch(() => {
      process.exitCode = 1;
    });
}

module.exports = {
  gracefulShutdown,
  startServer,
};
