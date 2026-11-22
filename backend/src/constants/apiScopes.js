const API_SCOPES = Object.freeze([
  'calendar:read',
  'calendar:write',
  'calendar:delete',
]);

const SCOPE_RANK = Object.freeze({
  'calendar:read': 1,
  'calendar:write': 2,
  'calendar:delete': 3,
});

function hasScope(scopes, requiredScope) {
  const requiredRank = SCOPE_RANK[requiredScope];
  return Boolean(requiredRank) && Array.isArray(scopes)
    && scopes.some((scope) => SCOPE_RANK[scope] >= requiredRank);
}

function normalizeScopes(scopes) {
  if (!Array.isArray(scopes)) return [];
  return API_SCOPES.filter((scope) => hasScope(scopes, scope));
}

function scopesThatPermit(requiredScope) {
  return API_SCOPES.filter((scope) => hasScope([scope], requiredScope));
}

module.exports = {
  API_SCOPES,
  SCOPE_RANK,
  hasScope,
  normalizeScopes,
  scopesThatPermit,
};
