const CALENDAR_ROLES = Object.freeze(['viewer', 'editor', 'admin']);

const ROLE_RANK = Object.freeze({ viewer: 1, editor: 2, admin: 3, owner: 4 });

// `admin` is the existing delete-capable calendar role. It also manages share
// links, email invitations, and direct members when authenticated through a
// Chronos session.
const CALENDAR_ROLE_CAPABILITIES = Object.freeze({
  viewer: Object.freeze(['calendar:read']),
  editor: Object.freeze(['calendar:read', 'calendar:write']),
  admin: Object.freeze([
    'calendar:read',
    'calendar:write',
    'calendar:delete',
    'calendar:share-links:manage',
    'calendar:invitations:manage',
    'calendar:members:manage',
  ]),
  owner: Object.freeze([
    'calendar:read',
    'calendar:write',
    'calendar:delete',
    'calendar:share-links:manage',
    'calendar:invitations:manage',
    'calendar:members:manage',
    'calendar:main:manage',
  ]),
});

function hasCalendarRole(actualRole, requiredRole) {
  return ROLE_RANK[actualRole] >= ROLE_RANK[requiredRole];
}

module.exports = {
  CALENDAR_ROLES,
  ROLE_RANK,
  CALENDAR_ROLE_CAPABILITIES,
  hasCalendarRole,
};
