const pino = require('pino');
const config = require('./config');

const outputLogLevelNames = Object.freeze({
  trace: 'TRACE',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'FATAL',
});

function formatLogLevel(label) {
  return {
    level: outputLogLevelNames[label] || label.toUpperCase(),
  };
}

const logger = pino({
  level: config.logLevel,
  base: {
    service: 'chronos-api',
    environment: config.env,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: formatLogLevel,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'clientSecret',
      '*.password',
      '*.uri',
      '*.connectionString',
    ],
    censor: '[REDACTED]',
  },
});

module.exports = logger;
module.exports.formatLogLevel = formatLogLevel;
