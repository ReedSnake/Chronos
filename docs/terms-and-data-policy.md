# Chronos terms and data policy

Status: describes the implemented baseline as of this repository revision. This document is product-facing policy guidance, not legal advice or a substitute for jurisdiction-specific terms.

## Calendar access and public links

A calendar has one owner. A signed-in member can be a `viewer`, `editor`, or `admin`: viewing is included in editing, and viewing plus editing are included in admin access. Admins can manage members, invitations, and public links in addition to calendar data. The owner alone can change the `isMain` setting.

A public calendar link is a bearer credential scoped to one calendar and one role. Anyone who possesses it may use it until it expires or is revoked. The raw token is put in the URL fragment and is sent to the API in an `Authorization: CalendarLink` header; it is not intended for search engines, public posting, or browser storage.

Using a public link never creates a calendar membership, even if the visitor signs in. An administrator can revoke a link, which immediately prevents its future use. A public link with admin-level access can change or delete its calendar, but cannot manage members, invitations, or other links.

## Email invitations

Calendar invitations are addressed to one normalized email address, have a role and expiry, and use a separate one-time bearer token. An invitation creates membership only when the recipient signs in or registers with the invited email and accepts a valid invitation. It does not grant access to another account with a different email.

Bulk invitations deduplicate addresses in the request, report an outcome per address, skip existing members and active pending invitations, and are rate-limited. Email delivery uses an in-process queue with limited concurrency; an email-delivery failure is reported per recipient. Expired, revoked, and accepted invitations must not be reused.

Chronos sends verification, calendar-invitation, and integration-pairing emails in English or Ukrainian according to the requester’s `Accept-Language` header. Email content includes only the information needed for that action: the resource or integration name, requested role or scopes, expiry context, and a token-bearing URL fragment.

## Integrations and API keys

An integration belongs to its creator. API keys are credentials for that integration, not user accounts. The raw key is displayed only when created; Chronos stores a keyed hash and a non-secret prefix. Keys must be kept out of URLs, browser storage, client-side source code, logs, and telemetry.

Scopes are hierarchical: `calendar:delete` includes `calendar:write` and `calendar:read`; `calendar:write` includes `calendar:read`. The server performs the final scope check for API keys, grants, and pairing requests. An integration key can access its owner’s calendars without a grant. Access to another user’s calendar requires that user’s active grant for the needed scope.

Revoking an API key stops it from authorizing future requests. Revoking an integration grant stops future access to the target user’s calendars. Disabling an integration prevents its use. The current baseline has no endpoint that permanently deletes integrations or API-key records.

## Personal data and retention

Chronos stores account details, calendar metadata, membership relationships, email addresses used for invitations and attendees, integration metadata, credential hashes/prefixes, permission grants, and event data. Raw API keys, public-link tokens, invitation tokens, pairing tokens, and attendee invitation tokens are not returned by read APIs and are stored as hashes where applicable.

Calendar deletion removes the calendar together with its members, share links, invitations, and event records. Revoked API keys, grants, links, and invitations are retained as stateful records until a model-specific cleanup path applies. Expired public links, calendar invitations, and pairing requests use MongoDB TTL indexes, so physical removal is asynchronous rather than immediate.

The current application does not implement an immutable audit-log store or a separately configured audit-retention period. Timestamps such as `createdAt`, `updatedAt`, `lastUsedAt`, `revokedAt`, and `respondedAt` are operational record fields, not a guaranteed historical audit trail. Do not rely on Chronos to preserve an audit record after a calendar or account-related record is deleted until a dedicated audit-retention feature is introduced.

## Localization and API clients

The API returns `errorCode` and `requestId` for errors, not a user-facing English `message`. Applications must localize error codes themselves and display a generic local error for an unknown code. The bundled UI supplies English and Ukrainian translations for statuses, role and scope labels, duration labels, and known error codes.

Clients should send `Accept-Language: en` or `Accept-Language: uk` when they require localized email delivery. API response field names, status values, scope values, and error codes remain English machine-readable identifiers and must not be translated before being sent back to the API.
