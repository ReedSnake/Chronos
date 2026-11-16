# Operations

## Environment files

- Docker Compose reads the repository-root `.env`. Create it from `.env.example`.
- The frontend has no `.env` file. Its public API URL is passed from the root `.env` to the container at runtime.
- Set `PORT`, `FRONTEND_PORT`, `MONGODB_HOST_PORT`, `PUBLIC_API_URL`, `FRONTEND_API_URL`, and `CORS_ORIGIN` to the URLs and ports for the target environment.
- Set `LOG_LEVEL` to `TRACE`, `DEBUG`, `INFO`, `WARNING`, `ERROR`, `FATAL`, or `SILENT`. Backend JSON logs display these readable severity names instead of numeric levels.
- Before Docker startup, set non-placeholder `JWT_SECRET`, `MONGODB_ROOT_USERNAME`, and `MONGODB_ROOT_PASSWORD` in the root `.env`. Compose passes the Mongo credentials to the database and the backend; it stops on missing values.
- Do not put a password, JWT, or client secret in a frontend runtime configuration: browser-visible values are public.

```powershell
Copy-Item .env.example .env
```

## Docker Compose workflows

```powershell
# Build and start every service in this order:
# mongo (healthy) -> backend (healthy) -> frontend
docker compose up --build

# Start one service together with the dependencies it needs
docker compose up -d mongo
docker compose up -d backend
docker compose up -d frontend

# Start exactly one already-configured service without its dependencies
docker compose up -d --no-deps backend
docker compose up -d --no-deps frontend

# Restart or stop one service
docker compose restart mongo
docker compose restart backend
docker compose restart frontend
docker compose stop mongo
docker compose stop backend
docker compose stop frontend

# Follow logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongo
```

### Reading logs without healthcheck noise

Docker captures server logs from standard output. Use the service name to view only the backend:

```powershell
# Last 100 backend records, then follow new records
docker compose logs --tail 100 -f backend

# Only backend warnings, errors, and fatal events
docker compose logs --no-log-prefix -f backend |
  Select-String '"level":"(WARNING|ERROR|FATAL)"'

# Backend messages from the last ten minutes
docker compose logs --since 10m backend
```

The frontend healthcheck uses `/health` with Nginx access logging disabled. MongoDB runs with `--quiet`, which suppresses routine connection-accepted/closed records while preserving useful startup and failure output.

## Database commands

```powershell
# Run only inside the backend container
docker compose exec backend node src/scripts/database.js init
docker compose exec backend node src/scripts/database.js seed
docker compose exec backend node src/scripts/database.js reset
docker compose exec backend node src/scripts/database.js drop
```

`docker compose down` preserves MongoDB data. `docker compose down -v`, `db:reset`, and `db:drop` are destructive.

MongoDB root credentials are created only when the `mongo-data` volume is first initialized. Changing those values later does not change an existing database volume.

## Development containers and rebuilds

```powershell
# Production-style images: build every changed image before start.
docker compose up -d --build

# Rebuild only one production service after changing its Dockerfile,
# dependencies, or source baked into its image.
docker compose up -d --build backend
docker compose up -d --build frontend

# Development containers: source folders are mounted and the Node/Vite watchers reload on code changes.
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

In development mode, ordinary edits in `backend/src` and `frontend/src` do not require a rebuild. Rebuild the affected service after changing a `package.json`, lockfile, Dockerfile, or Compose configuration.
