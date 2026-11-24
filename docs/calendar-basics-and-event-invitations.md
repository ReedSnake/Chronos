# Calendar basics and event invitations

## Behavior

- Registration provisions one main personal calendar. Login, email verification and calendar listing also provision missing main calendars for existing users; legacy main calendars keep their names, IDs and events. Archived main calendars become visible again. New main status cannot be selected manually. The owner can rename or change preferences on the main calendar, but no caller can demote, archive or delete it via calendar endpoints. Account deletion still removes owned calendars as before.
- Main/system calendar upserts use unique partial compound indexes. Database initialization builds the new indexes. No data reset is required. If legacy data already contains multiple main calendars for a user, index creation will fail; inspect and resolve those records manually before proceeding, preserving their events.
- With a supported country selected in Account, Chronos provisions one national holiday calendar. It uses the existing Nager.Date provider (PublicHolidays endpoint), only nationwide public holidays, date-only UTC values and a bounded 12-hour process cache. Calendar listing and account country updates synchronize the country; clearing the country removes the holiday calendar from the listing without deleting data. The holiday calendar is system-managed and read-only except for the owner's hide/show preference. User-created additional calendars remain deletable. Virtual holiday events are not stored in MongoDB and cannot be edited, shared or invited to. Provider failures return a localized recoverable error instead of fabricated holidays. Provider data may differ from legally observed days off; verify it as appropriate.
- Event invite delivery is explicit: save attendee emails, open event details, and click Send invitation for the recipient. It requires a signed-in editor/admin/owner (not an API key). It uses existing Gmail SMTP configuration and sends a localized message with a seven-day single-use token in the URL fragment. Only SHA-256 token hashes are stored in the existing attendee record. Failed delivery invalidates the token; retry after one minute. Per-user and per-IP rate limits are process-local. Accept/decline applies to an entire recurring series and does not grant calendar membership or copy the event into the recipient's calendar. Recipients need not register; possession of the link authorizes only the response to that invitation. Removing an attendee or deleting the event revokes its token. Public shared calendar event responses no longer expose attendee emails.
- For actual remote recipients, the configured frontend URL must be reachable by them (HTTPS in production). Localhost links only work for a browser that can reach the local server. Existing `GMAIL_USER`, `GMAIL_APP_PASSWORD` and `CORS_ORIGIN` settings are reused.

## API additions

| Method | Endpoint | Body | Access |
| --- | --- | --- | --- |
| POST | `/api/calendars/:id/events/:eventId/invitations` | `{ "email": "friend@example.test" }` | Session, editor or above |
| POST | `/api/event-invitations/preview` | `{ "token": "..." }` | Valid pending token |
| POST | `/api/event-invitations/respond` | `{ "token": "...", "response": "accepted" }` (or `declined`) | Valid pending token |

Calendar responses include `isHolidayCalendar`. Event attendee responses include `invitationSentAt`, `expiresAt` and `inviteStatus`, never the token hash. The preview only exposes limited event details, not other attendees or calendar access.

## Verification after applying changes

Use the existing `.env` and database volume; never use `docker compose down -v` to update.

1. `docker compose up -d --build` and `docker compose ps`; inspect backend logs for successful index creation. Open the web application and hard-refresh.
2. Register and verify a new test user; open Calendars and confirm exactly one main calendar. Reload repeatedly. Sign in with an existing account; confirm its previous calendars/events are intact and a missing main is provisioned.
3. Verify the main calendar cannot be hidden or deleted in the UI or via direct API `PATCH` (`isMain:false`, `isArchived:true`) and `DELETE`, including using an admin membership, integration API key or editor share link where applicable. Rename the main calendar and verify it persists. Create and delete an ordinary calendar.
4. In Account choose Ukraine (`UA`), open the national holidays calendar, and inspect January/December and the next year. Compare against Nager.Date. Change the profile country to another supported country; reload, verify holidays and IDs change accordingly, and test hide/show. Clear the country. Try editing holiday events or sharing the holiday calendar via API and expect refusal.
5. Create an ordinary meeting and add two controlled email addresses. Save, open details, send one invitation. Open the email link in a separate browser, preview, accept, then reload the sender's calendar and verify the attendee status. Repeat with decline for the other recipient. Attempt reuse of an answered token and confirm it fails. Try resending a pending invitation; verify the previous link no longer works and the cooldown is enforced. Delete the event or remove the attendee and verify its link fails. Confirm viewers cannot send and public calendar links omit attendee emails.
6. Run `npm test` in both `backend` and `frontend` after dependency installation. In particular, run `node --test tests/calendarBasics.test.js` in backend. Unit tests use mocked database, holiday provider and mail boundaries; they do not replace the live MongoDB, SMTP, browser and external provider checks above.
