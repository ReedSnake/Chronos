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
      { name: 'Users', description: 'Profile and account management.' },
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
        get: { tags: ['Auth'], summary: 'Backward-compatible alias for GET /api/users/me', responses: { 200: { description: 'Own profile.' }, 401: { description: 'Authentication required.' } } },
      },
      '/api/users/me': {
        get: { tags: ['Users'], summary: 'Get own full profile (requires session cookie)', responses: { 200: { description: 'Full profile, email and preferences.' }, 401: { description: 'Not signed in.' } } },
        patch: { tags: ['Users'], summary: 'Update own name and/or bio', requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', properties: { name: { type: 'string', maxLength: 120 }, bio: { type: 'string', maxLength: 500 } }, additionalProperties: false,
        } } } }, responses: { 200: { description: 'Updated own profile.' }, 400: { description: 'Invalid update.' }, 401: { description: 'Not signed in.' } } },
        delete: { tags: ['Users'], summary: 'Permanently delete own account, avatar and all sessions', responses: { 204: { description: 'Account deleted.' }, 401: { description: 'Not signed in.' } } },
      },
      '/api/users/me/country': {
        patch: { tags: ['Users'], summary: 'Update or clear country', requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', required: ['country'], additionalProperties: false, properties: { country: { type: 'string', nullable: true, description: 'Two-letter code or null' } },
        } } } }, responses: { 200: { description: 'Updated.' }, 400: { description: 'Invalid country.' }, 401: { description: 'Not signed in.' } } },
      },
      '/api/users/me/settings': {
        patch: { tags: ['Users'], summary: 'Update one or more stored preferences', requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', additionalProperties: false, properties: {
            language: { type: 'string', enum: ['uk', 'en', 'ru'] }, timeZone: { type: 'string', example: 'Europe/Kyiv' },
            weekStartsOn: { type: 'string', enum: ['monday', 'sunday'] }, timeFormat: { type: 'string', enum: ['12h', '24h'] },
          },
        } } } }, responses: { 200: { description: 'Updated preferences.' }, 400: { description: 'Invalid values.' }, 401: { description: 'Not signed in.' } } },
      },
      '/api/users/me/avatar': {
        put: { tags: ['Users'], summary: 'Replace avatar with raw image bytes, maximum 2 MB', requestBody: { required: true, content: {
          'image/jpeg': { schema: { type: 'string', format: 'binary' } },
          'image/png': { schema: { type: 'string', format: 'binary' } },
          'image/webp': { schema: { type: 'string', format: 'binary' } },
        } }, responses: { 200: { description: 'Avatar updated.' }, 400: { description: 'Invalid image.' }, 413: { description: 'Image too large.' }, 415: { description: 'Unsupported format.' } } },
        delete: { tags: ['Users'], summary: 'Remove own avatar', responses: { 200: { description: 'Avatar removed.' }, 401: { description: 'Not signed in.' } } },
      },
      '/api/users/{id}': {
        get: { tags: ['Users'], summary: 'Get limited public fields of another profile (session required)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Name, bio, country, avatar and join date; no email, settings or secrets.' }, 400: { description: 'Invalid ID.' }, 401: { description: 'Not signed in.' }, 404: { description: 'Profile not found.' } } },
      },
      '/api/users/{id}/avatar': {
        get: { tags: ['Users'], summary: 'Fetch publicly displayable profile image (no session required)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'JPEG, PNG or WebP image.' }, 404: { description: 'No image.' } } },
      },
      '/api/auth/logout': {
        post: { tags: ['Auth'], summary: 'Revoke current session and clear the cookie', responses: { 204: { description: 'Signed out.' } } },
      },
    },
  },
  apis: [],
};

module.exports = options.definition;
