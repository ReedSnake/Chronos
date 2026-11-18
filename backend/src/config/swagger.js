const config = require('./config');

const statusResponse = {
  type: 'object',
  required: ['status', 'timestamp'],
  properties: {
    status: { type: 'string', example: 'ok' },
    timestamp: { type: 'string', format: 'date-time' },
    database: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'connected' },
      },
    },
  },
};

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Chronos API',
      version: '1.0.0',
      description: 'Chronos server API, with email registration and session-based authentication.',
    },
    servers: [{
      url: config.documentation.serverUrl,
      description: 'Configured API server',
    }],
    tags: [
      { name: 'System', description: 'Server and database status endpoints.' },
      { name: 'Auth', description: 'Email registration, verification and cookie sessions.' },
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          required: ['error', 'requestId'],
          properties: {
            error: { type: 'string', example: 'Endpoint not found' },
            requestId: { type: 'string', example: 'b45472e5-cc4d-4603-b038-a96f8c99d7cf' },
          },
        },
        AuthStatus: {
          type: 'object',
          required: ['service', 'status', 'timestamp'],
          properties: {
            service: { type: 'string', example: 'auth' },
            status: { type: 'string', example: 'available' },
            message: { type: 'string', example: 'Email authentication is available.' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    paths: {
      '/api/health': {
        get: {
          tags: ['System'],
          summary: 'Get server and database readiness status',
          responses: {
            200: { description: 'The API and MongoDB are ready.', content: { 'application/json': { schema: statusResponse } } },
            503: { description: 'The API is running but MongoDB is not connected.', content: { 'application/json': { schema: statusResponse } } },
          },
        },
      },
      '/api/auth/status': {
        get: {
          tags: ['Auth'],
          summary: 'Get authentication module status',
          responses: {
            200: { description: 'Authentication module status.', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthStatus' } } } },
          },
        },
      },
      '/api/auth/register': {
        post: {
          tags: ['Auth'], summary: 'Register with name, email and password',
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['name', 'email', 'password'], properties: {
              name: { type: 'string' }, email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' },
            },
          } } } },
          responses: { 201: { description: 'Verification email accepted by Gmail SMTP.' }, 409: { description: 'Email already registered.' }, 503: { description: 'Email service unavailable.' } },
        },
      },
      '/api/auth/resend-verification': {
        post: {
          tags: ['Auth'], summary: 'Resend a verification link to an unverified account',
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } },
          } } } },
          responses: { 200: { description: 'Request processed.' }, 429: { description: 'Rate limit or resend cooldown.' }, 503: { description: 'Email service unavailable.' } },
        },
      },
      '/api/auth/verify-email': {
        post: {
          tags: ['Auth'], summary: 'Consume one-time verification token and sign in',
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['token'], properties: { token: { type: 'string' } },
          } } } },
          responses: { 200: { description: 'Verified; session cookie set.' }, 400: { description: 'Expired or invalid token.' } },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'], summary: 'Sign in with a verified email',
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['email', 'password'], properties: {
              email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' },
            },
          } } } },
          responses: { 200: { description: 'Session cookie set.' }, 401: { description: 'Invalid credentials.' }, 403: { description: 'Email not verified.' } },
        },
      },
      '/api/auth/me': {
        get: { tags: ['Auth'], summary: 'Get signed-in user', responses: { 200: { description: 'User details.' }, 401: { description: 'Authentication required.' } } },
      },
      '/api/auth/logout': {
        post: { tags: ['Auth'], summary: 'Revoke current session and clear the cookie', responses: { 204: { description: 'Signed out.' } } },
      },
    },
  },
  apis: [],
};

module.exports = options.definition;
