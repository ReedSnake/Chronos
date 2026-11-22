import assert from 'node:assert/strict';
import test from 'node:test';
import { IntegrationService } from '../src/services/IntegrationService.js';
import { scopeLabel, scopesLabel, statusLabel } from '../src/features/integrations/labels.js';

function recorder() {
  const calls = [];
  return {
    calls,
    get: async (...args) => { calls.push(['GET', ...args]); return { requests: [] }; },
    post: async (...args) => { calls.push(['POST', ...args]); return {}; },
    delete: async (...args) => { calls.push(['DELETE', ...args]); },
  };
}

test('integration consent routes continue to use the authenticated user API', async () => {
  const client = recorder();
  const service = new IntegrationService(client);
  await service.listRequests();
  await service.approvePairing('request-1');
  await service.rejectPairing('request-2');
  await service.revokeGrant('grant-1');
  assert.deepEqual(client.calls, [
    ['GET', '/me/integration-requests'],
    ['POST', '/me/integration-requests/request-1/approve', {}],
    ['POST', '/me/integration-requests/request-2/reject', {}],
    ['DELETE', '/me/integration-grants/grant-1'],
  ]);
});

test('integration labels preserve the scope level and localization', () => {
  const t = (key) => ({
    'integrations.resourceCalendar': 'Calendar',
    'integrations.scopeRead': 'Read',
    'integrations.scopeWrite': 'Write',
    'integrations.scopeDelete': 'Delete',
    'statuses.active': 'Active',
  })[key] || key;
  assert.equal(scopeLabel(t, ['calendar:read', 'calendar:write']), 'Calendar: Write');
  assert.equal(scopesLabel(t, ['calendar:read']), 'Calendar: Read');
  assert.equal(statusLabel(t, 'active'), 'Active');
});
