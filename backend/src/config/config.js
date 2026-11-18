const path = require('node:path');
const dotenv = require('dotenv');

const rootEnvPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: rootEnvPath, quiet: true });

function getInteger(name, value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === '') {
    return fallback;
  }
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function getOrigins(value) {
  if (!value) {
    return ['http://localhost:5173'];
  }
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.map((origin) => (origin === '*' ? origin : validateUrl('CORS_ORIGIN', origin)));
}

function getOptionalValue(value) {
  return value || undefined;
}

function isPlaceholder(value) {
  return !value || /^(replace|change|example)/i.test(value);
}

function validateUrl(name, value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${name} must use http or https`);
  }
  return value;
}

function validateMongoUri(value) {
  if (!/^mongodb(\+srv)?:\/\//i.test(value)) {
    throw new Error('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }
  return value;
}

function validateSecretPair(idName, id, secretName, secret) {
  if (Boolean(id) !== Boolean(secret)) {
    throw new Error(`${idName} and ${secretName} must be set together`);
  }
}

const port = getInteger('PORT', process.env.PORT, 3000, { min: 1, max: 65535 });
const frontendPort = getInteger('FRONTEND_PORT', process.env.FRONTEND_PORT, 5173, { min: 1, max: 65535 });
const host = process.env.HOST || '0.0.0.0';
const publicApiUrl = validateUrl('PUBLIC_API_URL', process.env.PUBLIC_API_URL || `http://localhost:${port}`);
const frontendApiUrl = validateUrl('FRONTEND_API_URL', process.env.FRONTEND_API_URL || `${publicApiUrl}/api`);
const mongodbUsername = getOptionalValue(process.env.MONGODB_USERNAME);
const mongodbPassword = getOptionalValue(process.env.MONGODB_PASSWORD);
const externalServiceClientId = getOptionalValue(process.env.EXTERNAL_SERVICE_CLIENT_ID);
const externalServiceClientSecret = getOptionalValue(process.env.EXTERNAL_SERVICE_CLIENT_SECRET);
const configuredLogLevel = (process.env.LOG_LEVEL || 'INFO').trim().toLowerCase();
const logLevel = configuredLogLevel === 'warning' ? 'warn' : configuredLogLevel;

if (!['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'].includes(logLevel)) {
  throw new Error('LOG_LEVEL must be one of TRACE, DEBUG, INFO, WARNING, WARN, ERROR, FATAL, or SILENT');
}

validateSecretPair('MONGODB_USERNAME', mongodbUsername, 'MONGODB_PASSWORD', mongodbPassword);
validateSecretPair(
  'EXTERNAL_SERVICE_CLIENT_ID',
  externalServiceClientId,
  'EXTERNAL_SERVICE_CLIENT_SECRET',
  externalServiceClientSecret,
);

if ((process.env.NODE_ENV || 'development') === 'production') {
  if (isPlaceholder(process.env.JWT_SECRET)) {
    throw new Error('JWT_SECRET must be set to a non-placeholder value in production');
  }
  if (mongodbUsername && isPlaceholder(mongodbPassword)) {
    throw new Error('MONGODB_PASSWORD must be set to a non-placeholder value when MONGODB_USERNAME is configured in production');
  }
}

const config = Object.freeze({
  env: process.env.NODE_ENV || 'development',
  host,
  port,
  rootEnvPath,
  logLevel,
  corsOrigins: getOrigins(process.env.CORS_ORIGIN),
  frontend: {
    port: frontendPort,
    apiUrl: frontendApiUrl,
  },
  documentation: {
    serverUrl: publicApiUrl,
  },
  database: {
    uri: validateMongoUri(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chronos'),
    databaseName: process.env.MONGODB_DATABASE || undefined,
    username: mongodbUsername,
    password: mongodbPassword,
    authSource: getOptionalValue(process.env.MONGODB_AUTH_SOURCE),
    autoInitialize: process.env.DATABASE_AUTO_INITIALIZE !== 'false',
    serverSelectionTimeoutMS: getInteger('MONGODB_SERVER_SELECTION_TIMEOUT_MS', process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 5000, { min: 100 }),
    connectRetryDelayMS: getInteger('MONGODB_CONNECT_RETRY_DELAY_MS', process.env.MONGODB_CONNECT_RETRY_DELAY_MS, 5000, { min: 100 }),
    maxPoolSize: getInteger('MONGODB_MAX_POOL_SIZE', process.env.MONGODB_MAX_POOL_SIZE, 10, { min: 1 }),
  },
  integrations: {
    externalService: {
      clientId: externalServiceClientId,
      clientSecret: externalServiceClientSecret,
    },
  },
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  auth: {
    secureCookies: process.env.COOKIE_SECURE === 'true',
  },
  mail: {
    user: getOptionalValue(process.env.GMAIL_USER),
    appPassword: getOptionalValue(process.env.GMAIL_APP_PASSWORD),
    frontendUrl: getOrigins(process.env.CORS_ORIGIN).find((origin) => origin !== '*'),
  },
});

module.exports = config;
