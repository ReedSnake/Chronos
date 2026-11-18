const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const app = require('../src/app');
const config = require('../src/config/config');
const { formatLogLevel } = require('../src/config/logger');
const swaggerSpecification = require('../src/config/swagger');
const User = require('../src/models/User');

let server;
let baseUrl;

function request(path) {
  return new Promise((resolve, reject) => {
    http.get(`${baseUrl}${path}`, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        resolve({
          body,
          headers: response.headers,
          statusCode: response.statusCode,
        });
      });
    }).on('error', reject);
  });
}

test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test('health endpoint reports a degraded server before MongoDB is connected', async () => {
  const response = await request('/api/health');
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 503);
  assert.equal(body.status, 'degraded');
  assert.equal(body.database.status, 'disconnected');
  assert.ok(response.headers['x-request-id']);
});

test('auth status reports authentication available', async () => {
  const response = await request('/api/auth/status');
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.service, 'auth');
  assert.equal(body.status, 'available');
});

test('Swagger describes the available API routes', () => {
  assert.ok(swaggerSpecification.paths['/api/health']);
  assert.ok(swaggerSpecification.paths['/api/auth/status']);
  assert.ok(swaggerSpecification.paths['/api/auth/login']);
  assert.ok(swaggerSpecification.paths['/api/auth/register']);
  assert.equal(swaggerSpecification.servers[0].url, config.documentation.serverUrl);
});

test('logger formats numeric Pino levels as readable severity names', () => {
  assert.deepEqual(formatLogLevel('warn'), { level: 'WARNING' });
  assert.deepEqual(formatLogLevel('error'), { level: 'ERROR' });
  assert.deepEqual(formatLogLevel('fatal'), { level: 'FATAL' });
});

test('user model normalizes ISO country codes and requires the initial fields', async () => {
  const user = new User({
    email: 'tester@example.test',
    passwordHash: 'hash',
    name: 'Test User',
    country: 'ua',
  });

  await user.validate();
  assert.equal(user.country, 'UA');
  assert.equal(user.email, 'tester@example.test');
});
