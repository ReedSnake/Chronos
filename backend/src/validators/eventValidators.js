const AppError = require('../utils/AppError');
const { EVENT_TYPES } = require('../constants/eventTypes');

function invalid(message) {
  throw new AppError(message, 400, 'VALIDATION_ERROR');
}

function parseDate(value, field, endOfDay = false) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be an ISO date or date-time`);
  const normalized = value.trim();
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) invalid(`${field} must be an ISO date or date-time`);
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
}

function parseValues(value, field) {
  if (value === undefined) return [];
  const rawValues = Array.isArray(value) ? value : [value];
  const values = rawValues
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
    .map((item) => item.trim())
    .filter(Boolean);
  if (!values.length) invalid(`${field} must not be empty`);
  return [...new Set(values)];
}

function parseTypes(value) {
  const types = parseValues(value, 'types');
  if (types.some((type) => !EVENT_TYPES.includes(type))) {
    invalid(`types must contain only: ${EVENT_TYPES.join(', ')}`);
  }
  return types;
}

function parseCategories(value) {
  const categories = [...new Set(parseValues(value, 'categories').map((category) => category.toLowerCase()))];
  if (categories.some((category) => category.length > 64 || !/^[a-z0-9][a-z0-9 _-]*$/.test(category))) {
    invalid('categories must contain safe category names up to 64 characters');
  }
  return categories;
}

function parsePositiveInteger(value, field, defaultValue, maximum) {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > maximum) {
    invalid(`${field} must be an integer between 1 and ${maximum}`);
  }
  return Number(value);
}

function validateEventFilters(query, { allowTargetUserId = false } = {}) {
  const data = query && typeof query === 'object' ? query : {};
  const allowed = ['from', 'to', 'types', 'categories', 'page', 'limit', ...(allowTargetUserId ? ['targetUserId'] : [])];
  if (Object.keys(data).some((field) => !allowed.includes(field))) {
    invalid(`Allowed filters: ${allowed.join(', ')}`);
  }
  const from = parseDate(data.from, 'from');
  const to = parseDate(data.to, 'to', true);
  if (from && to && from > to) invalid('from must be before or equal to to');
  return {
    from,
    to,
    types: data.types === undefined ? [] : parseTypes(data.types),
    categories: data.categories === undefined ? [] : parseCategories(data.categories),
    page: parsePositiveInteger(data.page, 'page', 1, 100000),
    limit: parsePositiveInteger(data.limit, 'limit', 50, 100),
  };
}

module.exports = { validateEventFilters };
