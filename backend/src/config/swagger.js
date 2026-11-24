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
      description: 'Chronos server API, with email registration and session-based authentication. Error responses use stable errorCode and requestId fields; clients localize error codes themselves.',
    },
    servers: [{
      url: config.documentation.serverUrl,
      description: 'Configured API server',
    }],
    tags: [
      { name: 'System', description: 'Server and database status endpoints.' },
      { name: 'Auth', description: 'Email registration, verification and cookie sessions.' },
      { name: 'Users', description: 'Profile and account management.' },
      { name: 'Calendars', description: 'Personal and shared calendar management.' },
      { name: 'Events', description: 'Event CRUD, recurring occurrences and attendee email records.' },
      { name: 'Integrations', description: 'Session-managed integrations and revocable API keys.' },
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          required: ['errorCode', 'requestId'],
          properties: {
            errorCode: { type: 'string', example: 'ENDPOINT_NOT_FOUND' },
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
        put: { tags: ['Users'], summary: 'Update or clear country after validating it with the countries provider', requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', required: ['country'], additionalProperties: false, properties: { country: { type: 'string', nullable: true, description: 'Two-letter code or null' } },
        } } } }, responses: { 200: { description: 'Updated.' }, 400: { description: 'Invalid or unsupported country.' }, 401: { description: 'Not signed in.' }, 503: { description: 'Countries provider is unavailable.' } } },
      },
      '/api/users/me/settings': {
        patch: { tags: ['Users'], summary: 'Update one or more stored preferences', requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', additionalProperties: false, properties: {
            timeZone: { type: 'string', example: 'Europe/Kyiv' },
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
      '/api/calendars': {
        get: {
          tags: ['Calendars'],
          summary: 'List calendars owned by or shared with the signed-in user, or by the API-key targetUserId',
          parameters: [{ name: 'targetUserId', in: 'query', required: false, schema: { type: 'string' }, description: 'For API-key requests, omit to use the integration owner. A different user requires an active calendar grant.' }],
          responses: { 200: { description: 'Calendars with the caller role.' }, 401: { description: 'Not signed in.' } },
        },
        post: {
          tags: ['Calendars'],
          summary: 'Create a personal calendar or, with an API key, one for the owner or an active-grant target user',
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['name'], additionalProperties: false, properties: {
              name: { type: 'string', maxLength: 120 },
              description: { type: 'string', maxLength: 2000 },
              color: { type: 'string', example: '#3B82F6' },
              countryCode: { type: 'string', nullable: true, example: 'UA' },
              isMain: { type: 'boolean' },
              timeZone: { type: 'string', example: 'Europe/Kyiv' },
              defaultView: { type: 'string', enum: ['month', 'agenda'] },
              isArchived: { type: 'boolean' },
              defaultEventDurationMinutes: { type: 'integer', minimum: 5, maximum: 1440 },
              targetUserId: { type: 'string', description: 'For API-key requests, omit to use the integration owner. A different user requires an active integration grant.' },
            },
          } } } },
          responses: { 201: { description: 'Calendar created.' }, 400: { description: 'Invalid calendar.' }, 401: { description: 'Not signed in or API key invalid.' }, 404: { description: 'Target user did not grant API access.' }, 409: { description: 'A main calendar already exists.' } },
        },
      },
      '/api/calendars/{id}': {
        get: {
          tags: ['Calendars'], summary: 'Get a calendar available to the signed-in user',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'targetUserId', in: 'query', required: false, schema: { type: 'string' }, description: 'For API-key requests, omit to use the integration owner. A different user requires an active read grant.' },
          ],
          responses: { 200: { description: 'Calendar.' }, 401: { description: 'Not signed in.' }, 404: { description: 'Calendar unavailable.' } },
        },
        patch: {
          tags: ['Calendars'], summary: 'Update a calendar with editor, admin, or owner access',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'targetUserId', in: 'query', required: false, schema: { type: 'string' }, description: 'For API-key requests, omit to use the integration owner. A different user requires an active write grant.' },
          ],
          responses: { 200: { description: 'Calendar updated.' }, 403: { description: 'Only the owner may set isMain.' }, 404: { description: 'Calendar unavailable.' } },
        },
        delete: {
          tags: ['Calendars'], summary: 'Delete a calendar with admin or owner access',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'targetUserId', in: 'query', required: false, schema: { type: 'string' }, description: 'For API-key requests, omit to use the integration owner. A different user requires an active delete grant.' },
          ],
          responses: { 204: { description: 'Calendar deleted.' }, 404: { description: 'Calendar unavailable.' } },
        },
      },
      '/api/calendars/{id}/events': {
        post: {
          tags: ['Events'], summary: 'Create arrangement, task, reminder or holiday with editor access',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'targetUserId', in: 'query', schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['type', 'title'], additionalProperties: true, description: 'Type-specific date required (startsAt+endsAt, deadline, remindAt, or date+internationalName); attendee emails are an array of strings.' } } } },
          responses: { 201: { description: 'Created event.' }, 400: { description: 'Invalid payload.' }, 404: { description: 'Calendar inaccessible.' } },
        },
        get: {
          tags: ['Calendars'],
          summary: 'List events and virtual recurring occurrences in a date range; max range 370 days',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'from', in: 'query', required: false, schema: { type: 'string', format: 'date-time' }, description: 'Inclusive event-range start. A date-only value is accepted.' },
            { name: 'to', in: 'query', required: false, schema: { type: 'string', format: 'date-time' }, description: 'Inclusive event-range end. A date-only value includes the whole UTC day.' },
            { name: 'types', in: 'query', required: false, schema: { type: 'string', example: 'arrangement,task' }, description: 'Comma-separated event types: arrangement, task, reminder, holiday.' },
            { name: 'categories', in: 'query', required: false, schema: { type: 'string', example: 'work,personal' }, description: 'Comma-separated event category tags.' },
            { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
            { name: 'targetUserId', in: 'query', required: false, schema: { type: 'string' }, description: 'For API-key requests, omit to use the integration owner. A different user requires an active read grant.' },
          ],
          responses: { 200: { description: 'Paginated events and generated occurrences. Each occurrence keeps the series id and a unique occurrenceId; no separate database record is created.' }, 400: { description: 'Invalid filters or too many occurrences.' }, 401: { description: 'Not signed in or API key invalid.' }, 404: { description: 'Calendar unavailable.' } },
        },
      },
      '/api/calendars/{id}/events/{eventId}': {
        get: {
          tags: ['Events'], summary: 'Read one event series, with viewer access',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'targetUserId', in: 'query', schema: { type: 'string' } }],
          responses: { 200: { description: 'Stored event series.' }, 404: { description: 'Event or calendar inaccessible.' } },
        },
        patch: {
          tags: ['Events'], summary: 'Edit an event or the entire recurring series; editor access required',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'targetUserId', in: 'query', schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true, description: 'Any editable event fields except type; validates against the original event type.' } } } },
          responses: { 200: { description: 'Updated series.' }, 400: { description: 'Invalid payload.' }, 404: { description: 'Event or calendar inaccessible.' } },
        },
        delete: {
          tags: ['Events'], summary: 'Delete the event or entire recurring series with editor access',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'targetUserId', in: 'query', schema: { type: 'string' } }],
          responses: { 204: { description: 'Event deleted.' }, 404: { description: 'Event or calendar inaccessible.' } },
        },
      },
      '/api/calendars/{id}/share-links': {
        get: {
          tags: ['Calendars'], summary: 'List share-link metadata with admin or owner access',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Share-link metadata, never tokens.' }, 404: { description: 'Calendar unavailable.' } },
        },
        post: {
          tags: ['Calendars'], summary: 'Create a temporary viewer, editor, or admin share link',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['role', 'expiresInMinutes'], additionalProperties: false, properties: {
              role: { type: 'string', enum: ['viewer', 'editor', 'admin'] },
              expiresInMinutes: { type: 'integer', nullable: true, minimum: 5, maximum: 43200, description: 'Null creates a permanent share link.' },
            },
          } } } },
          responses: { 201: { description: 'Share URL returned exactly once with its token in the fragment.' }, 404: { description: 'Calendar unavailable.' } },
        },
      },
      '/api/calendars/{id}/share-links/{linkId}': {
        delete: {
          tags: ['Calendars'], summary: 'Revoke an active calendar share link',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'linkId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { 204: { description: 'Link revoked.' }, 404: { description: 'Link or calendar unavailable.' } },
        },
      },
      '/api/calendars/{id}/members': {
        get: {
          tags: ['Calendars'], summary: 'List the owner and direct calendar members with admin or owner access',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Owner and member metadata.' }, 404: { description: 'Calendar unavailable.' } },
        },
        post: {
          tags: ['Calendars'], summary: 'Add an existing verified Chronos user as a calendar member',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['email', 'role'], additionalProperties: false, properties: {
              email: { type: 'string', format: 'email' },
              role: { type: 'string', enum: ['viewer', 'editor', 'admin'] },
            },
          } } } },
          responses: { 201: { description: 'Member added.' }, 404: { description: 'Verified user or calendar unavailable.' }, 409: { description: 'User is already the owner or a member.' } },
        },
      },
      '/api/calendars/{id}/members/{memberId}': {
        patch: {
          tags: ['Calendars'], summary: 'Change a direct calendar member role with admin or owner access',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'memberId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['role'], additionalProperties: false, properties: { role: { type: 'string', enum: ['viewer', 'editor', 'admin'] } },
          } } } },
          responses: { 200: { description: 'Member updated.' }, 403: { description: 'Owner role cannot be changed.' }, 404: { description: 'Member or calendar unavailable.' } },
        },
        delete: {
          tags: ['Calendars'], summary: 'Remove a direct calendar member with admin or owner access',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'memberId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { 204: { description: 'Member removed.' }, 403: { description: 'Owner cannot be removed.' }, 404: { description: 'Member or calendar unavailable.' } },
        },
      },
      '/api/calendars/{id}/invitations': {
        get: {
          tags: ['Calendars'], summary: 'List email invitations with admin or owner access',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Invitation metadata.' }, 404: { description: 'Calendar unavailable.' } },
        },
        post: {
          tags: ['Calendars'], summary: 'Send an email invitation for a registered or new user',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['email', 'role', 'expiresInMinutes'], additionalProperties: false, properties: {
              email: { type: 'string', format: 'email' },
              role: { type: 'string', enum: ['viewer', 'editor', 'admin'] },
              expiresInMinutes: { type: 'integer', minimum: 5, maximum: 43200 },
            },
          } } } },
          responses: { 201: { description: 'Invitation email accepted.' }, 400: { description: 'Invalid invitation.' }, 409: { description: 'Recipient is already a member or has a pending invitation.' }, 503: { description: 'Email service unavailable.' } },
        },
      },
      '/api/calendars/{id}/invitations/bulk': {
        post: {
          tags: ['Calendars'], summary: 'Queue up to 50 email invitations and poll the invitation list for delivery status',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['emails', 'role', 'expiresInMinutes'], additionalProperties: false, properties: {
              emails: { type: 'array', minItems: 1, maxItems: 50, items: { type: 'string', format: 'email' } },
              role: { type: 'string', enum: ['viewer', 'editor', 'admin'] },
              expiresInMinutes: { type: 'integer', minimum: 5, maximum: 43200 },
            },
          } } } },
          responses: { 202: { description: 'Per-recipient queued, duplicate, already-member, already-pending, or failed results. Poll GET /api/calendars/{id}/invitations for deliveryStatus.' }, 429: { description: 'Invitation delivery rate limit exceeded.' }, 503: { description: 'Email service unavailable.' } },
        },
      },
      '/api/calendars/{id}/invitations/{invitationId}': {
        delete: {
          tags: ['Calendars'], summary: 'Revoke a pending email invitation',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'invitationId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { 204: { description: 'Invitation revoked.' }, 404: { description: 'Invitation or calendar unavailable.' } },
        },
      },
      '/api/calendar-invitations/remember': {
        post: {
          tags: ['Calendars'], summary: 'Validate an email invitation and retain it in an HttpOnly temporary cookie',
          responses: { 204: { description: 'Invitation remembered until login or expiry.' }, 400: { description: 'Invitation invalid or expired.' } },
        },
      },
      '/api/calendar-invitations/claim': {
        post: {
          tags: ['Calendars'], summary: 'Claim the pending email invitation for the signed-in invited email',
          responses: { 200: { description: 'Calendar membership created.' }, 204: { description: 'No valid invitation is pending.' }, 401: { description: 'Not signed in.' } },
        },
      },
      '/api/calendar-share': {
        get: {
          tags: ['Calendars'], summary: 'Read a shared calendar with Authorization: CalendarLink <token>',
          responses: { 200: { description: 'Shared calendar.' }, 401: { description: 'Invalid or expired link.' }, 403: { description: 'Link lacks required access.' } },
        },
        patch: {
          tags: ['Calendars'], summary: 'Update a shared calendar with an editor or admin link',
          responses: { 200: { description: 'Calendar updated.' }, 401: { description: 'Invalid or expired link.' }, 403: { description: 'Link lacks required access.' } },
        },
      },
      '/api/calendar-share/events': {
        get: {
          tags: ['Calendars'], summary: 'Read calendar events including generated recurring occurrences through a public link; no public write actions',
          parameters: [
            { name: 'from', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
            { name: 'to', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
            { name: 'types', in: 'query', required: false, schema: { type: 'string', example: 'arrangement,task' } },
            { name: 'categories', in: 'query', required: false, schema: { type: 'string', example: 'work,personal' } },
            { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
          ],
          responses: { 200: { description: 'Event records only.' }, 400: { description: 'Invalid filters.' }, 401: { description: 'Invalid or expired link.' }, 403: { description: 'Link lacks required access.' } },
        },
      },
      '/api/integrations': {
        get: {
          tags: ['Integrations'],
          summary: 'List integrations owned by the signed-in user',
          responses: { 200: { description: 'Owned integrations.' }, 401: { description: 'Not signed in.' } },
        },
        post: {
          tags: ['Integrations'],
          summary: 'Create an integration for the signed-in user',
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['name'], additionalProperties: false, properties: { name: { type: 'string', maxLength: 120 } },
          } } } },
          responses: { 201: { description: 'Integration created.' }, 400: { description: 'Invalid integration.' }, 401: { description: 'Not signed in.' } },
        },
      },
      '/api/integrations/{id}': {
        patch: {
          tags: ['Integrations'],
          summary: 'Rename, disable, or reactivate an owned integration',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Integration updated.' }, 401: { description: 'Not signed in.' }, 404: { description: 'Integration not found.' } },
        },
      },
      '/api/integrations/{id}/keys': {
        get: {
          tags: ['Integrations'],
          summary: 'List API-key metadata without secrets',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Key metadata.' }, 401: { description: 'Not signed in.' }, 404: { description: 'Integration not found.' } },
        },
        post: {
          tags: ['Integrations'],
          summary: 'Create an API key and return its secret exactly once',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['label', 'scopes'], additionalProperties: false, properties: {
              label: { type: 'string', maxLength: 120 },
              scopes: { type: 'array', description: 'The server expands implied scopes: delete includes write and read; write includes read.', items: { type: 'string', enum: ['calendar:read', 'calendar:write', 'calendar:delete'] } },
            },
          } } } },
          responses: { 201: { description: 'Key created; save the raw value now.' }, 400: { description: 'Invalid key request.' }, 401: { description: 'Not signed in.' }, 404: { description: 'Integration not found.' } },
        },
      },
      '/api/integrations/{id}/keys/{keyId}': {
        delete: {
          tags: ['Integrations'],
          summary: 'Revoke an API key',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'keyId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { 204: { description: 'Key revoked.' }, 401: { description: 'Not signed in.' }, 404: { description: 'API key not found.' } },
        },
      },
      '/api/integrations/me/pairing-requests': {
        post: {
          tags: ['Integrations'],
          summary: 'Request another verified user approval with an API key',
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['email', 'scopes'], additionalProperties: false, properties: {
              email: { type: 'string', format: 'email' },
              scopes: { type: 'array', description: 'The server expands implied scopes: delete includes write and read; write includes read.', items: { type: 'string', enum: ['calendar:read', 'calendar:write', 'calendar:delete'] } },
            },
          } } } },
          responses: { 202: { description: 'Neutral response; email enumeration is not possible.' }, 401: { description: 'API key invalid.' }, 403: { description: 'Requested scopes exceed the key.' } },
        },
      },
      '/api/integrations/me/pairing-requests/{id}': {
        get: {
          tags: ['Integrations'], summary: 'Read the status of an API-key pairing request',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Status. Target user ID is available only after approval.' }, 401: { description: 'API key invalid.' }, 404: { description: 'Request unavailable.' } },
        },
      },
      '/api/me/integration-requests': {
        get: {
          tags: ['Integrations'], summary: 'List the signed-in user pending integration requests',
          responses: { 200: { description: 'Pending requests.' }, 401: { description: 'Not signed in.' } },
        },
      },
      '/api/me/integration-requests/resolve': {
        post: {
          tags: ['Integrations'], summary: 'Resolve an email-link token for the signed-in target user',
          responses: { 200: { description: 'Request details.' }, 400: { description: 'Invalid or expired token.' }, 401: { description: 'Not signed in.' } },
        },
      },
      '/api/me/integration-requests/{id}/approve': {
        post: {
          tags: ['Integrations'], summary: 'Approve a pending integration request',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Active grant.' }, 400: { description: 'Request invalid or expired.' }, 401: { description: 'Not signed in.' } },
        },
      },
      '/api/me/integration-requests/{id}/reject': {
        post: {
          tags: ['Integrations'], summary: 'Reject a pending integration request',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 204: { description: 'Request rejected.' }, 400: { description: 'Request invalid or expired.' }, 401: { description: 'Not signed in.' } },
        },
      },
      '/api/me/integration-grants': {
        get: {
          tags: ['Integrations'], summary: 'List active applications connected to the signed-in user',
          responses: { 200: { description: 'Active grants.' }, 401: { description: 'Not signed in.' } },
        },
      },
      '/api/me/integration-grants/{id}': {
        delete: {
          tags: ['Integrations'], summary: 'Revoke an application access grant',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 204: { description: 'Grant revoked.' }, 401: { description: 'Not signed in.' }, 404: { description: 'Grant not found.' } },
        },
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
