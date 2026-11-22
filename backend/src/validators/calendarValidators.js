const AppError = require('../utils/AppError');
const { CALENDAR_ROLES } = require('../constants/calendarRoles');

function invalid(message) {
  throw new AppError(message, 400, 'VALIDATION_ERROR');
}

function requireObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid('Invalid request body');
  }
  return value;
}

function validateTimeZone(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) {
    invalid('Calendar timeZone must be a valid IANA time zone');
  }
  const timeZone = value.trim();
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format();
  } catch {
    invalid('Calendar timeZone must be a valid IANA time zone');
  }
  return timeZone;
}

function validateCalendarPreferences(data, values) {
  if (Object.hasOwn(data, 'timeZone')) values.timeZone = validateTimeZone(data.timeZone);
  if (Object.hasOwn(data, 'defaultView')) {
    if (!['month', 'agenda'].includes(data.defaultView)) invalid('Calendar defaultView must be month or agenda');
    values.defaultView = data.defaultView;
  }
  if (Object.hasOwn(data, 'isArchived')) {
    if (typeof data.isArchived !== 'boolean') invalid('Calendar isArchived must be a boolean');
    values.isArchived = data.isArchived;
  }
  if (Object.hasOwn(data, 'defaultEventDurationMinutes')) {
    if (!Number.isInteger(data.defaultEventDurationMinutes)
      || data.defaultEventDurationMinutes < 5 || data.defaultEventDurationMinutes > 1440) {
      invalid('Calendar default event duration must be between 5 and 1440 minutes');
    }
    values.defaultEventDurationMinutes = data.defaultEventDurationMinutes;
  }
}

function validateCalendarCreate(body, { allowTargetUserId = false, requireTargetUserId = false } = {}) {
  const data = requireObject(body);
  const allowed = ['name', 'description', 'color', 'countryCode', 'isMain', 'timeZone', 'defaultView', 'isArchived', 'defaultEventDurationMinutes', ...(allowTargetUserId ? ['targetUserId'] : [])];
  const fields = Object.keys(data);
  if (!fields.includes('name') || fields.some((field) => !allowed.includes(field))) {
    invalid(`Allowed fields: ${allowed.join(', ')}`);
  }

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (name.length < 1 || name.length > 120) {
    invalid('Calendar name must be between 1 and 120 characters');
  }

  const values = { name };
  if (Object.hasOwn(data, 'description')) {
    if (typeof data.description !== 'string' || data.description.trim().length > 2000) {
      invalid('Calendar description must be at most 2000 characters');
    }
    values.description = data.description.trim();
  }
  if (Object.hasOwn(data, 'color')) {
    if (typeof data.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(data.color.trim())) {
      invalid('Calendar color must be a six-digit hex color');
    }
    values.color = data.color.trim().toUpperCase();
  }
  if (Object.hasOwn(data, 'countryCode')) {
    if (data.countryCode === null) {
      values.countryCode = null;
    } else if (typeof data.countryCode === 'string' && /^[a-z]{2}$/i.test(data.countryCode.trim())) {
      values.countryCode = data.countryCode.trim().toUpperCase();
    } else {
      invalid('Calendar countryCode must be a two-letter country code or null');
    }
  }
  if (Object.hasOwn(data, 'isMain')) {
    if (typeof data.isMain !== 'boolean') invalid('Calendar isMain must be a boolean');
    values.isMain = data.isMain;
  }
  validateCalendarPreferences(data, values);
  if (allowTargetUserId && Object.hasOwn(data, 'targetUserId')) {
    if (typeof data.targetUserId !== 'string' || !/^[0-9a-f]{24}$/i.test(data.targetUserId)) {
      invalid('Calendar targetUserId must be a valid user ID');
    }
    values.targetUserId = data.targetUserId;
  }
  if (requireTargetUserId && !Object.hasOwn(values, 'targetUserId')) {
    invalid('Calendar targetUserId is required for API-key requests');
  }
  return values;
}

function validateCalendarUpdate(body) {
  const data = requireObject(body);
  const allowed = ['name', 'description', 'color', 'countryCode', 'isMain', 'timeZone', 'defaultView', 'isArchived', 'defaultEventDurationMinutes'];
  const fields = Object.keys(data);
  if (!fields.length || fields.some((field) => !allowed.includes(field))) {
    invalid(`Allowed fields: ${allowed.join(', ')}`);
  }
  const values = {};
  if (Object.hasOwn(data, 'name')) {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (name.length < 1 || name.length > 120) invalid('Calendar name must be between 1 and 120 characters');
    values.name = name;
  }
  if (Object.hasOwn(data, 'description')) {
    if (typeof data.description !== 'string' || data.description.trim().length > 2000) {
      invalid('Calendar description must be at most 2000 characters');
    }
    values.description = data.description.trim();
  }
  if (Object.hasOwn(data, 'color')) {
    if (typeof data.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(data.color.trim())) {
      invalid('Calendar color must be a six-digit hex color');
    }
    values.color = data.color.trim().toUpperCase();
  }
  if (Object.hasOwn(data, 'countryCode')) {
    if (data.countryCode === null) values.countryCode = null;
    else if (typeof data.countryCode === 'string' && /^[a-z]{2}$/i.test(data.countryCode.trim())) values.countryCode = data.countryCode.trim().toUpperCase();
    else invalid('Calendar countryCode must be a two-letter country code or null');
  }
  if (Object.hasOwn(data, 'isMain')) {
    if (typeof data.isMain !== 'boolean') invalid('Calendar isMain must be a boolean');
    values.isMain = data.isMain;
  }
  validateCalendarPreferences(data, values);
  return values;
}

function validateCalendarShareCreate(body) {
  const data = requireObject(body);
  const allowed = ['role', 'expiresInMinutes'];
  const fields = Object.keys(data);
  if (fields.length !== 2 || fields.some((field) => !allowed.includes(field))) {
    invalid(`Allowed fields: ${allowed.join(', ')}`);
  }
  if (!CALENDAR_ROLES.includes(data.role)) {
    invalid(`Calendar share role must be one of: ${CALENDAR_ROLES.join(', ')}`);
  }
  if (data.expiresInMinutes !== null
    && (!Number.isInteger(data.expiresInMinutes) || data.expiresInMinutes < 5 || data.expiresInMinutes > 43200)) {
    invalid('Calendar share expiry must be between 5 minutes and 30 days');
  }
  return { role: data.role, expiresInMinutes: data.expiresInMinutes };
}

function validateCalendarInvitationCreate(body) {
  const data = requireObject(body);
  const allowed = ['email', 'role', 'expiresInMinutes'];
  const fields = Object.keys(data);
  if (fields.length !== 3 || fields.some((field) => !allowed.includes(field))) {
    invalid(`Allowed fields: ${allowed.join(', ')}`);
  }
  if (typeof data.email !== 'string') invalid('Enter a valid email address');
  const email = data.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid('Enter a valid email address');
  if (!CALENDAR_ROLES.includes(data.role)) {
    invalid(`Calendar invitation role must be one of: ${CALENDAR_ROLES.join(', ')}`);
  }
  if (!Number.isInteger(data.expiresInMinutes) || data.expiresInMinutes < 5 || data.expiresInMinutes > 43200) {
    invalid('Calendar invitation expiry must be between 5 minutes and 30 days');
  }
  return { email, role: data.role, expiresInMinutes: data.expiresInMinutes };
}

function validateCalendarInvitationBulkCreate(body) {
  const data = requireObject(body);
  const allowed = ['emails', 'role', 'expiresInMinutes'];
  const fields = Object.keys(data);
  if (fields.length !== 3 || fields.some((field) => !allowed.includes(field))) {
    invalid(`Allowed fields: ${allowed.join(', ')}`);
  }
  if (!Array.isArray(data.emails) || !data.emails.length || data.emails.length > 50) {
    invalid('Invite between 1 and 50 email addresses');
  }
  const invitation = validateCalendarInvitationCreate({
    email: data.emails[0],
    role: data.role,
    expiresInMinutes: data.expiresInMinutes,
  });
  const emails = data.emails.map((email) => {
    if (typeof email !== 'string') invalid('Enter a valid email address');
    const normalized = email.trim().toLowerCase();
    if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      invalid('Enter a valid email address');
    }
    return normalized;
  });
  return { emails, role: invitation.role, expiresInMinutes: invitation.expiresInMinutes };
}

function validateCalendarMemberCreate(body) {
  const data = requireObject(body);
  const allowed = ['email', 'role'];
  const fields = Object.keys(data);
  if (fields.length !== 2 || fields.some((field) => !allowed.includes(field))) {
    invalid(`Allowed fields: ${allowed.join(', ')}`);
  }
  if (typeof data.email !== 'string') invalid('Enter a valid email address');
  const email = data.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid('Enter a valid email address');
  if (!CALENDAR_ROLES.includes(data.role)) {
    invalid(`Calendar member role must be one of: ${CALENDAR_ROLES.join(', ')}`);
  }
  return { email, role: data.role };
}

function validateCalendarMemberUpdate(body) {
  const data = requireObject(body);
  const fields = Object.keys(data);
  if (fields.length !== 1 || !Object.hasOwn(data, 'role') || !CALENDAR_ROLES.includes(data.role)) {
    invalid(`Calendar member role must be one of: ${CALENDAR_ROLES.join(', ')}`);
  }
  return { role: data.role };
}

function validateCalendarInvitationToken(body) {
  const data = requireObject(body);
  const fields = Object.keys(data);
  if (fields.length !== 1 || !Object.hasOwn(data, 'token') || typeof data.token !== 'string'
    || !/^ci_[A-Za-z0-9_-]{12}\.[A-Za-z0-9_-]{43}$/.test(data.token)) {
    invalid('Invalid calendar invitation link');
  }
  return { token: data.token };
}

function validateCalendarId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{24}$/i.test(value)) invalid('Invalid calendar ID');
  return value;
}

function validateTargetUserId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{24}$/i.test(value)) {
    invalid('Calendar targetUserId must be a valid user ID');
  }
  return value;
}

module.exports = {
  validateCalendarCreate,
  validateCalendarId,
  validateCalendarInvitationCreate,
  validateCalendarInvitationBulkCreate,
  validateCalendarInvitationToken,
  validateCalendarMemberCreate,
  validateCalendarMemberUpdate,
  validateCalendarShareCreate,
  validateCalendarUpdate,
  validateTargetUserId,
};
