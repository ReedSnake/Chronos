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
      description: 'Chronos server API. Authentication is currently represented by a documented stub endpoint.',
    },
    servers: [{
      url: config.documentation.serverUrl,
      description: 'Configured API server',
    }],
    tags: [
      { name: 'System', description: 'Server and database status endpoints.' },
      { name: 'Auth', description: 'Authentication module placeholder endpoints.' },
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
            status: { type: 'string', example: 'not_implemented' },
            message: { type: 'string', example: 'Authentication endpoints are not implemented yet.' },
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
          summary: 'Get authentication module placeholder status',
          description: 'This endpoint is a stub. It does not authenticate a user.',
          responses: {
            200: { description: 'Authentication module placeholder status.', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthStatus' } } } },
          },
        },
      },
    },
  },
  apis: [],
};

module.exports = options.definition;
