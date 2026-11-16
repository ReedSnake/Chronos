# Chronos agent guidelines

These are default working agreements, not absolute rules. Explicit user instructions take priority.

## Language and scope

- Keep source code, identifiers, code comments, logs, API messages, configuration keys, and project documentation in English.
- Communicate with the user in the language they use.
- Inspect the relevant implementation before changing it. Preserve unrelated work already present in the worktree.
- Keep changes small and within the current task. Do not introduce dependencies, frameworks, or architectural layers without a concrete need.

## Project boundaries

`frontend/` and `backend/` are separate projects.

- A frontend task may change `frontend/**` only. It must not edit `backend/**`.
- A backend task may change `backend/**` only. It must not edit `frontend/**`.
- Root infrastructure files (`docker-compose*.yml`, root `.env.example`, shared operations documentation) are shared scope. Change them only when the task explicitly requires infrastructure work.
- If a task requires crossing from one project into the other, first state which files need to change, why the cross-project change is necessary, and its expected API or behavior impact. Wait for user approval before editing the other project.
- After an approved cross-project change, report the files changed and the contract or behavior affected.

## Architecture

- Prefer clear responsibilities, DRY, SOLID, and existing utilities/services over duplicate implementations.
- Avoid speculative abstractions, unnecessary classes, global mutable state, and broad refactors.
- Backend: keep controllers thin; place business rules in services; keep models, validation, middleware, and database access separated.
- Frontend: keep UI components focused on presentation; use shared API clients/services; keep routing client-side; handle loading, empty, and error states explicitly.
- Validate untrusted input on both client and server. The server is the authorization authority.
- Use meaningful HTTP status codes and centralized error handling. Never expose internal database or stack details to clients.

## Security and data

- Never print, commit, hard-code, or expose secrets. `.env` files stay local; browser-visible `VITE_*` values and runtime frontend config must contain public data only.
- Store passwords only as secure hashes. Use cryptographically secure random values for security tokens.
- Enforce authorization on the server for every protected resource.
- Define data constraints in Mongoose models, including required fields, uniqueness, indexes, and relationship integrity where applicable.

## Docker and configuration

- Keep frontend, backend, and database in separate containers with environment-based configuration.
- Preserve database data across normal restarts. Make destructive database actions explicit and clearly labelled.
- Keep operational logs actionable: log state changes and failures, but avoid healthcheck noise and secrets.

## Quality and handoff

- Run the focused tests, build, lint, or configuration validation relevant to changed code.
- Update concise operational or API documentation only when behavior, configuration, or commands change.
- Report what changed, verification performed, and any limitation or unverified integration.
