import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpClient, HttpError } from '../src/api/HttpClient.js';

test('API client forwards active UI language even for API-key pairing requests', async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  const calls = [];
  globalThis.document = { documentElement: { lang: 'uk' } };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return new Response(JSON.stringify({ messageCode: 'PAIRING_REQUEST_SENT' }), {
      status: 202, headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const client = new HttpClient({ baseUrl: 'https://chronos.example/api', timeoutMs: 1000 });
    await client.post('/integrations/me/pairing-requests', { email: 'recipient@example.test' }, {
      headers: { Authorization: 'Bearer api-test' },
    });
    assert.equal(calls[0].headers['Accept-Language'], 'uk');
    assert.equal(calls[0].headers.Authorization, 'Bearer api-test');
    assert.equal(calls[0].credentials, 'include');
    assert.equal(calls[0].url, 'https://chronos.example/api/integrations/me/pairing-requests');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.document = originalDocument;
  }
});

test('API client localizes errors by returning a code, not an untrusted server message', async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  globalThis.document = { documentElement: { lang: 'en' } };
  globalThis.fetch = async () => new Response(JSON.stringify({ errorCode: 'NO_ACCESS', message: 'internal details' }), {
    status: 403, headers: { 'Content-Type': 'application/json' },
  });
  try {
    const client = new HttpClient({ baseUrl: 'https://chronos.example/api', timeoutMs: 1000 });
    await assert.rejects(() => client.get('/calendar-share'), (error) =>
      error instanceof HttpError && error.code === 'NO_ACCESS' && error.statusCode === 403);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.document = originalDocument;
  }
});
