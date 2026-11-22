const assert = require('node:assert/strict');
const test = require('node:test');
const {
  hasScope,
  normalizeScopes,
  scopesThatPermit,
} = require('../src/constants/apiScopes');

test('calendar scopes are hierarchical and normalize to their effective permissions', () => {
  assert.equal(hasScope(['calendar:read'], 'calendar:write'), false);
  assert.equal(hasScope(['calendar:write'], 'calendar:read'), true);
  assert.equal(hasScope(['calendar:delete'], 'calendar:write'), true);
  assert.equal(hasScope(['calendar:delete'], 'calendar:read'), true);
  assert.deepEqual(normalizeScopes(['calendar:write']), ['calendar:read', 'calendar:write']);
  assert.deepEqual(normalizeScopes(['calendar:delete']), ['calendar:read', 'calendar:write', 'calendar:delete']);
  assert.deepEqual(scopesThatPermit('calendar:write'), ['calendar:write', 'calendar:delete']);
});
