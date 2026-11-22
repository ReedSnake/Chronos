const AppError = require('../utils/AppError');
const { API_SCOPES, normalizeScopes } = require('../constants/apiScopes');

function invalid(message) {
  throw new AppError(message, 400, 'VALIDATION_ERROR');
}

function requireObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Invalid request body');
  return value;
}

function requireAllowedFields(data, allowed, required = []) {
  const fields = Object.keys(data);
  if (fields.some((field) => !allowed.includes(field)) || required.some((field) => !fields.includes(field))) {
    invalid(`Allowed fields: ${allowed.join(', ')}`);
  }
  return fields;
}

function validateName(value, field) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < 1 || normalized.length > 120) {
    invalid(`${field} must be between 1 and 120 characters`);
  }
  return normalized;
}

function validateObjectId(value, field) {
  if (typeof value !== 'string' || !/^[0-9a-f]{24}$/i.test(value)) invalid(`Invalid ${field}`);
  return value;
}

function validateScopes(value) {
  if (!Array.isArray(value) || !value.length || value.some((scope) => !API_SCOPES.includes(scope))
    || new Set(value).size !== value.length) {
    invalid(`scopes must be a non-empty array of: ${API_SCOPES.join(', ')}`);
  }
  return normalizeScopes(value);
}

function validateIntegrationCreate(body) {
  const data = requireObject(body);
  requireAllowedFields(data, ['name'], ['name']);
  return { name: validateName(data.name, 'Integration name') };
}

function validateIntegrationUpdate(body) {
  const data = requireObject(body);
  const fields = requireAllowedFields(data, ['name', 'status']);
  if (!fields.length) invalid('At least one field is required');
  const values = {};
  if (Object.hasOwn(data, 'name')) values.name = validateName(data.name, 'Integration name');
  if (Object.hasOwn(data, 'status')) {
    if (!['active', 'disabled'].includes(data.status)) invalid('Integration status must be active or disabled');
    values.status = data.status;
  }
  return values;
}

function validateApiKeyCreate(body) {
  const data = requireObject(body);
  requireAllowedFields(data, ['label', 'scopes'], ['label', 'scopes']);
  return { label: validateName(data.label, 'API key label'), scopes: validateScopes(data.scopes) };
}

function validateEmail(value) {
  if (typeof value !== 'string') invalid('Enter a valid email address');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    invalid('Enter a valid email address');
  }
  return email;
}

function validatePairingCreate(body) {
  const data = requireObject(body);
  requireAllowedFields(data, ['email', 'scopes'], ['email', 'scopes']);
  return { email: validateEmail(data.email), scopes: validateScopes(data.scopes) };
}

function validatePairingToken(body) {
  const data = requireObject(body);
  requireAllowedFields(data, ['token'], ['token']);
  if (typeof data.token !== 'string' || !/^[a-f0-9]{64}$/i.test(data.token)) {
    invalid('Invalid pairing link');
  }
  return { token: data.token.toLowerCase() };
}

module.exports = {
  validateIntegrationCreate,
  validateIntegrationUpdate,
  validateApiKeyCreate,
  validatePairingCreate,
  validatePairingToken,
  validateObjectId,
};
