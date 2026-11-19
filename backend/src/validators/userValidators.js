const AppError = require('../utils/AppError');

function invalid(message) {
  throw new AppError(message, 400, 'VALIDATION_ERROR');
}

function requireFields(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Invalid request body');
  const fields = Object.keys(body);
  if (!fields.length || fields.some((key) => !allowed.includes(key))) {
    invalid(`Allowed fields: ${allowed.join(', ')}`);
  }
  return fields;
}

function validateProfile(body) {
  const fields = requireFields(body, ['name', 'bio']);
  const values = {};
  for (const field of fields) {
    if (typeof body[field] !== 'string') invalid(`${field} must be a string`);
    const value = body[field].trim();
    if (field === 'name' && (value.length < 1 || value.length > 120)) {
      invalid('Name must be between 1 and 120 characters');
    }
    if (field === 'bio' && value.length > 500) invalid('Bio must not exceed 500 characters');
    values[field] = value;
  }
  return values;
}

function validateCountry(body) {
  requireFields(body, ['country']);
  if (body.country === null) return { country: null };
  if (typeof body.country !== 'string' || !/^[a-z]{2}$/i.test(body.country.trim())) {
    invalid('Country must be a two-letter country code, or null to clear it');
  }
  return { country: body.country.trim().toUpperCase() };
}

function validateSettings(body) {
  const allowed = ['timeZone', 'weekStartsOn', 'timeFormat'];
  const fields = requireFields(body, allowed);
  const updates = {};
  for (const field of fields) {
    const value = body[field];
    if (typeof value !== 'string') invalid(`${field} must be a string`);
    if (field === 'weekStartsOn' && !['monday', 'sunday'].includes(value)) invalid('Invalid start of week');
    if (field === 'timeFormat' && !['12h', '24h'].includes(value)) invalid('Invalid time format');
    if (field === 'timeZone') {
      if (value.length > 100) invalid('Invalid time zone');
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
      } catch {
        invalid('Invalid IANA time zone');
      }
    }
    updates[`settings.${field}`] = value;
  }
  return updates;
}

function validateUserId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{24}$/i.test(value)) {
    invalid('Invalid user ID');
  }
  return value;
}

module.exports = { validateProfile, validateCountry, validateSettings, validateUserId };
