const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateRegistration,
  validateLogin,
  validateResend,
  validateVerification,
} = require('../src/validators/authValidators');

test('registration validates and normalizes incoming data', () => {
  assert.deepEqual(
    validateRegistration({ name: '  Jane Doe  ', email: '  JANE@Example.COM ', password: 'a-long-password' }),
    { name: 'Jane Doe', email: 'jane@example.com', password: 'a-long-password' },
  );
});

test('registration rejects invalid email, name and password', () => {
  const valid = { name: 'Jane', email: 'jane@example.com', password: 'long-password' };
  for (const body of [null, [], { ...valid, name: '' }, { ...valid, email: 'not-email' },
    { ...valid, password: 'short' }, { ...valid, password: '😀'.repeat(20) }]) {
    assert.throws(() => validateRegistration(body), { statusCode: 400 });
  }
});

test('login and resend validate email without exposing passwords', () => {
  assert.deepEqual(validateLogin({ email: 'USER@Example.com', password: 'abc' }),
    { email: 'user@example.com', password: 'abc' });
  assert.deepEqual(validateResend({ email: ' USER@Example.com ' }), { email: 'user@example.com' });
  assert.throws(() => validateLogin({ email: 'user@example.com' }), { statusCode: 400 });
});

test('verification tokens must be cryptographically sized hex strings', () => {
  const token = 'ab'.repeat(32);
  assert.deepEqual(validateVerification({ token }), { token });
  assert.throws(() => validateVerification({ token: 'short' }), { statusCode: 400 });
  assert.throws(() => validateVerification({ token: null }), { statusCode: 400 });
});
