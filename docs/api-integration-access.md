# API Integration Access Design

Status: baseline implemented. Read-only calendar event records and filtered event retrieval are available; creation, modification, recurrence expansion, and attendee-delivery workflows remain out of scope. The OpenAPI document at `/api-docs` is the request-level API contract.

See [Terms and data policy](terms-and-data-policy.md) for the retention and personal-data rules that apply to these APIs.

## Implemented baseline

- `Integration`, `ApiKey`, `IntegrationAccessGrant`, and short-lived `PairingRequest` collections with the indexes described below.
- Session-only integration and key management. Raw API keys are HMAC-hashed and returned only on creation.
- An API key acts on its integration owner's calendars when `targetUserId` is omitted. A different target user requires that user's active integration grant.
- Email pairing requests with fragment tokens, target-user approval or rejection, connected-app listing, and grant revocation.
- `Calendar`, `CalendarMember`, `CalendarShareLink`, and `CalendarInvitation` collections. Share links and invitations use `viewer`, `editor`, or `admin` access. Only an accepted email invitation creates durable membership; a public link remains bearer access only.
- `Event` records belong to one calendar. `GET /api/calendars/:id/events` returns only event records and supports independent date-range and multi-category filters.

Set `API_KEY_HASH_SECRET`, `CALENDAR_SHARE_HASH_SECRET`, and `CALENDAR_INVITATION_HASH_SECRET` to distinct high-entropy server-only secrets. `JWT_SECRET` is only a development fallback for backwards compatibility; production requires non-placeholder values.

## Goals

- Keep interactive Chronos accounts, email verification, and browser sessions.
- Let an authenticated user create revocable API keys for their own integrations.
- Allow a service to work with more than one Chronos account only after every account owner explicitly grants access.
- Keep an API key rotatable without losing users, calendar data, or consent grants.
- Avoid exposing raw API keys in URLs, browser storage, logs, or telemetry.

## Concepts and ownership

```text
User
 ├── owns Integrations
 │    └── own API keys (one or more)
 └── grants an Integration limited access to the user's calendar
      through IntegrationAccessGrant
```

`User` remains the durable owner of their calendar data. An `Integration` is the durable identity of a service such as a Zoom plugin, GitHub Action, or private script. An `ApiKey` is a credential belonging to an Integration; it is never the owner of a user or calendar.

The same Integration can have multiple active keys for separate environments or key rotation. Revoking a key has no effect on its grants, users, or calendar data.

## Data model

### Integration

```text
ownerUserId     required User reference
name            required display name
status          active | disabled
createdAt
updatedAt
```

An Integration is created and managed only by its interactive owner through a browser session.

### ApiKey

```text
integrationId   required Integration reference
ownerUserId     required User reference, denormalized for authorization lookups
label           required, for example "Zoom production"
prefix          required, unique, non-secret lookup prefix
secretHash      required, never selected or returned
scopes          required array of allowed API operations
status          active | inactive | revoked
lastUsedAt      nullable timestamp
revokedAt       nullable timestamp
createdAt
```

The raw key is generated from at least 256 bits of cryptographically secure randomness. It is returned only by key creation or rotation, and is not stored after the response is sent. The database stores a keyed hash of the secret and a non-secret prefix.

No fixed expiration is required. A future inactivity policy may change a key from `active` to `inactive`; manual revocation must always be available.

### IntegrationAccessGrant

```text
integrationId   required Integration reference
userId          required User reference
scopes          required array, for example calendar:write
status          pending | active | revoked
requestedAt
grantedAt       nullable timestamp
revokedAt       nullable timestamp
```

There must be a unique compound index on `integrationId` and `userId`.

### PairingRequest

`PairingRequest` stores the target user, integration, grant, requested scopes, a hash of a 256-bit email token, state, and an expiry. It has a TTL index for cleanup; authorization always checks expiry before the TTL monitor runs.

The target is also stored as a normalized email. This allows an integration to notify and invite a person before they have a Chronos account. After registration, they see the pending request and must explicitly approve it before any grant becomes active.

### Calendar access

`Calendar` has one durable owner. `CalendarMember` is a separate collection with a unique `calendarId + userId` index. The calendar role matrix is hierarchical:

| Role | Calendar operations | Session-only management operations |
| --- | --- | --- |
| `viewer` | Read calendar and event records | None |
| `editor` | Read calendar and event records; update calendar | None |
| `admin` | Read calendar and event records; update, delete calendar | Create, list, and revoke share links and invitations; list, add, update, and remove direct members |
| `owner` | All `admin` operations | May additionally change `isMain` |

`admin` is the existing delete-capable role; it is not renamed to `deleter` for compatibility. A public `CalendarLink` with `admin` access can read, update, or delete a calendar, but cannot manage links, invitations, or members directly because those endpoints require a Chronos session.

`CalendarShareLink` is separate from membership: it stores only a non-secret prefix and a keyed hash of its raw token. The raw token is returned only in the share URL fragment. Using a public link never creates a `CalendarMember`, including after sign-in. Revoking a share link immediately stops its bearer-token use.

`CalendarInvitation` is an email-targeted temporary access capability. It has a hashed token, invited email, role, status, and expiry. The recipient may register first; the invitation becomes a calendar membership only for an authenticated account with the invited email and only while it remains valid. An already-existing member retains the role set by an administrator; accepting an old invitation does not change it. Admins may also add an existing verified Chronos user directly as a member, which revokes any pending invitation for that address. Bulk invitations accept up to 50 email addresses, deduplicate addresses within a request, avoid already-pending/member recipients, and return a result for each address. Expired pending invitations are marked `expired` before a replacement may be issued. Delivery is rate-limited to 100 new invitations per sender and calendar per 15 minutes and processed with at most two concurrent deliveries in the in-process email queue.

### Event records

`Event` has a `calendarId`, indexed `startsAt`, type (`arrangement`, `task`, `reminder`, or `holiday`), title, description, color, category tags, recurrence fields, and optional attendees. The `calendarId + startsAt` and `calendarId + categories + startsAt` indexes support calendar range and tag queries. Type-specific fields are validated by the model: arrangements require `startsAt`, `endsAt`, and `scheduled` or `canceled` status; tasks require `deadline` and a task status; reminders require `remindAt`; holidays require `date` and `internationalName`. For non-arrangement types `startsAt` is populated from the type-specific date. Attendee invitation tokens are never returned by the read API.

`GET /api/calendars/:id/events?from&to&types=...&categories=...&page&limit` is a read-only baseline. It filters stored records by `startsAt`, supports comma-separated types and category tags, and returns `{ events, pagination }`; `limit` is capped at 100. Calendar metadata remains at `GET /api/calendars/:id`. Recurring records are returned as their stored base record; occurrence expansion is intentionally not implemented yet. A viewer-capable public share link can use the equivalent `GET /api/calendar-share/events` endpoint.

`Calendar` also stores its IANA `timeZone`, `defaultView` (`month` or `agenda`), `isArchived`, and `defaultEventDurationMinutes` (5–1440). They are returned as calendar metadata and are not duplicated in event responses.

An API key can create a pending pairing request but can never activate a grant. Only the target user, while authenticated in Chronos, can approve it. A user can revoke an active grant at any time.

## Authentication and authorization

### Interactive website requests

The existing cookie session authenticates the user. Key management and grant approval require this authentication method.

### API requests

An integration sends its secret only in the HTTP `Authorization` header:

```http
Authorization: Bearer <raw-api-key>
```

The API-key middleware verifies the prefix, compares the keyed hash in constant time, checks the key status and required scope, updates `lastUsedAt`, and sets an API principal:

```text
userId          Integration owner for owner-only operations
integrationId
apiKeyId
scopes
authType         api-key
```

When `targetUserId` is omitted, the API key operates on the integration owner's calendars without a grant. For an operation on another user, the service must additionally locate an active `IntegrationAccessGrant` for the API key's `integrationId`, target `userId`, and required scope. Missing or revoked grants must not disclose whether the target user exists.

## Scopes

Initial scopes should remain small and explicit:

- `calendar:read`
- `calendar:write`
- `calendar:delete`

Scopes are hierarchical and are enforced on the server for API keys, grants, and pairing requests: `calendar:delete` includes `calendar:write` and `calendar:read`; `calendar:write` includes `calendar:read`. New key, grant, and pairing-request records are normalized to contain all implied scopes. Authorization also evaluates older records hierarchically, so an existing key or grant with only `calendar:delete` remains delete-, write-, and read-capable.

The API-key UI selects one supported resource or permission group in a dropdown and one access level with radio buttons. It sends the resulting scope such as `calendar:write`; the server validates the resource and normalizes the effective hierarchy, so a client-side selection never grants additional permission.

An Integration key must not receive user-creation, key-management, or unrestricted cross-user access merely because it can read calendar event records. Key management remains session-only in the first version.

## Response language and errors

The backend does not expose English error strings as an API contract. Every error response has this stable shape:

```json
{
  "errorCode": "CALENDAR_NOT_FOUND",
  "requestId": "..."
}
```

Clients must map `errorCode` to their own localized text and may use `requestId` when contacting support. Unknown codes must use a local generic fallback. The browser sends `Accept-Language` from its active locale; Chronos currently selects English or Ukrainian for verification, calendar-invitation, and pairing-request email templates. API clients may send the same header when creating a pairing request. `messageCode`, where present on a successful action, is likewise a stable machine-readable code rather than presentation text.

## Workflows

### Personal integration

1. The user signs in to Chronos.
2. The user creates an Integration and an API key with selected calendar scopes.
3. Chronos displays the raw key once.
4. The user stores it in the third-party service's server-side secret store.
5. Requests authenticated by that key act on the owner's calendars when no `targetUserId` is supplied. Supplying another user's ID requires that user's active grant.

Use a separate key per third-party service and environment. To rotate a key, create a replacement key, update the external service, verify it, then revoke the old key.

### Multi-user integration

1. A service creates a short-lived pending pairing request.
2. Chronos returns a one-time approval URL or pairing code, not an API key.
3. The target user signs in to Chronos and sees the Integration name and requested scopes.
4. The target user approves or rejects the request.
5. On approval, Chronos creates an active `IntegrationAccessGrant`.
6. The Integration can perform only the approved operations for that user.

Pairing requests are short-lived and one-time. They must not allow email or user-ID enumeration. The current implementation does not include a general immutable audit-log collection; do not treat operational timestamps or request logs as a permanent audit trail.

### Browser share flow

Do not put an API key in a link or browser-visible storage. Calendar sharing uses a separate `CalendarLink` bearer token scoped to one calendar and role. It is returned only in the fragment of a public URL, may be permanent or expire after a configured duration, and can be revoked. The browser sends it in the `Authorization: CalendarLink <token>` header. A visitor may use the link repeatedly, but the link does not create durable membership.

## Security requirements

- Require HTTPS in production.
- Never send an API key in a URL, query parameter, JSON payload, browser storage, logs, telemetry, or error message.
- Redact the `Authorization` header in application, proxy, and monitoring logs.
- Apply rate limits by API-key prefix and client IP.
- Return the raw key exactly once.
- Provide key listing metadata, revocation, and rotation without exposing secrets.
- Use least-privilege scopes and validate authorization in server services, not in the client.
- Retain only the timestamps explicitly described by each collection. A dedicated, immutable audit-retention feature is not implemented yet.

## Implemented API surface

The following paths are implemented; field schemas and all error codes are defined by `/api-docs`:

```text
Session-authenticated:
POST   /api/integrations
GET    /api/integrations
PATCH  /api/integrations/:id
POST   /api/integrations/:id/keys
GET    /api/integrations/:id/keys
DELETE /api/integrations/:id/keys/:keyId

API-key-authenticated:
POST   /api/calendars
POST   /api/integrations/me/pairing-requests
GET    /api/integrations/me/pairing-requests/:id

Session-authenticated target user:
GET    /api/me/integration-requests
POST   /api/me/integration-requests/:id/approve
POST   /api/me/integration-requests/:id/reject
DELETE /api/me/integration-grants/:id
```

Calendar share, calendar invitation, member-management, and event-read APIs are documented in `/api-docs`. Event write APIs and recurrence expansion are intentionally not implemented yet.

## Deletion and retention boundaries

- Revoking an API key changes its status to `revoked`; it does not delete the key record. Disabling an integration changes its status to `disabled`; integration deletion is not currently exposed.
- Revoking a public share link or a calendar invitation preserves its record until its normal expiry/TTL cleanup. A public-link visitor never becomes a member merely by using the link.
- Deleting a calendar deletes its members, public links, invitations, and event records as part of the same service workflow. It does not create a retained audit record in the current implementation.
- Grant revocation preserves the grant record with a revoked state. Pairing requests and temporary invitation/link records use expiry indexes and are eventually removed by MongoDB's TTL monitor.

## Out of scope for the first version

- Replacing browser sessions with API keys.
- Giving a personal key permission to create arbitrary Chronos accounts.
- Passing API keys through share URLs.
- Full OAuth authorization-server support.
- Provider-specific OAuth connections for GitHub or Zoom.
