# Stray

A retro photo-sharing app where your network is built in person — not online. To connect with someone you have to physically meet them and bump phones. No search, no discovery, no algorithmic feed. Just photos from people you've actually met.

## Stack

| Layer    | Tech |
|----------|------|
| Mobile   | React Native + Expo (SDK 54) |
| Frontend | React 19 + TypeScript + Vite |
| Backend  | Go + chi |
| Database | SQLite (via `mattn/go-sqlite3`) |
| Auth     | JWT (7-day tokens) |
| Uploads  | Local `/uploads` directory |

## Project structure

```
stray/
├── backend/          Go API
│   ├── main.go       Entry point + API handlers
│   ├── config.go     Environment validation
│   ├── server.go     HTTP routing + process lifecycle
│   ├── db.go         Models + all SQL queries
│   ├── middleware.go  JWT auth middleware
│   ├── schema.sql    Table definitions (embedded in binary)
│   └── seed.sql      Optional local demo data
├── mobile/           React Native + native iOS development build
│   ├── modules/      Local Expo modules, including CoreBluetooth BLE
│   ├── plugins/      Reproducible iOS prebuild configuration
│   └── src/
│       ├── config/   branding.ts — app name, copy, API URL
│       ├── context/  AuthContext
│       ├── lib/      api.ts, theme.ts, bumpService.ts
│       ├── navigation/
│       ├── screens/  Feed, Profile, Bump, Login, Register
│       └── components/ PostCard, Avatar, UploadModal
└── frontend/         React web SPA (companion)
    └── src/
        ├── components/
        ├── context/
        ├── lib/
        └── pages/    Feed, Profile, Login, Register
```

## Local dev

### Backend

```bash
cd backend
export JWT_SECRET="$(openssl rand -hex 32)"  # keep stable between restarts
go run .             # http://localhost:3000
```

Requires Go 1.26+ and a C compiler (for CGO/SQLite). On Mac, Xcode command line tools cover this:

```bash
xcode-select --install
```

The database directory is created automatically at `./data/app.db` on first run. Table definitions
are embedded from `schema.sql`. Startup requires a `JWT_SECRET` of at least 32 characters; generate
a random value, store it outside Git, and reuse it across deployments so existing tokens remain valid.
For local demo accounts, set `SEED_DEMO_DATA=true` when starting an empty database. Seeding is off
by default and does not run again once users exist. Existing databases are preserved, including any
old demo users; use a fresh database volume for a cloud test environment.

### Container deployment

Build the Linux image for an x86 EC2 instance (`t3.micro`, for example):

```bash
docker build --platform linux/amd64 -t the-wall-backend:dev ./backend
```

Run a prebuilt image with the deployment configuration:

```bash
export BACKEND_IMAGE=the-wall-backend:dev
export JWT_SECRET="$(openssl rand -hex 32)"  # first setup only; store securely for reuse
docker compose -f compose.deploy.yml up -d
curl --fail http://127.0.0.1:3000/healthz
```

`compose.deploy.yml` binds the API to loopback; an HTTPS reverse proxy on the same host must
provide external access. It stores SQLite and uploads in separate Docker named volumes, runs
as UID 10001, limits log growth, and allows 15 seconds for a graceful stop. `/healthz` returns
200 when the database is reachable and 503 when it is unavailable. A Docker health check marks
status; it does not automatically restart an unhealthy process.

Replace `BACKEND_IMAGE` with a private ECR image **digest** for a cloud release. An image digest
identifies exact contents; retaining the previous digest allows an application rollback. Database
schema changes may require a separate migration/rollback plan. Restart with the same JWT secret
and volumes. Do not use `docker compose down -v` unless intentionally deleting the stored data.

This configuration supports one backend instance. Volumes survive container replacement but do
not provide backups or protect against deletion/loss of the EC2 disk. Before using real user data,
add tested backups; moving photos to S3 and adopting a shared database are separate changes for
multi-instance operation. Use synthetic users/photos for the first test deployment.

The existing `docker-compose.yml` remains the LAN development setup and keeps its original data
mounts. On Linux, a bind-mounted database directory must be writable by UID 10001. Compose reads
the root `.env`; `go run .` does not load `.env` automatically.

### Mobile (iOS development build)

```bash
cd mobile
npm ci
npx expo prebuild --platform ios --clean
npx expo run:ios --device
```

BLE is implemented in a local native module, so it does not run in Expo Go. Use the generated
`ios/TheWall.xcworkspace` in Xcode or `npx expo run:ios --device`. Select your Apple development
team when Xcode asks for signing. The iPhone and Mac must be on the same Wi-Fi network while the
API and Metro are running.

**Set your local IP in `mobile/.env`:**

```
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
```

Find your IP with:
```bash
ipconfig getifaddr en0
```

Use `npx expo install` (not `npm install`) when adding new packages — it pins versions compatible with the current Expo SDK.

The iOS Simulator is useful for UI, TypeScript, Swift, and linking checks, but it cannot perform
the real phone-to-phone BLE exchange. Test proximity with two physical iPhones, two signed
development-build installs, and two different logged-in users. See the complete
[iPhone installation and testing guide](docs/ios-device-testing.md).

### Frontend (web)

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

## Test accounts

Available only when an empty local database is started with `SEED_DEMO_DATA=true`:

| Email | Password |
|-------|----------|
| alice@stray.dev | password123 |
| bob@stray.dev   | password123 |

Alice and Bob are already bumped.

## API

All protected routes require `Authorization: Bearer <token>`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Database readiness |
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login, returns JWT |
| GET | `/posts/feed` | Posts from bumped users + own |
| POST | `/posts` | Create post |
| POST | `/posts/{id}/like` | Toggle like |
| GET | `/users/{id}` | User profile + bumpCount + bumpStatus |
| POST | `/users/{id}/bump` | Toggle bump with a user |
| POST | `/bumps` | Create bump (proximity flow) |
| GET | `/bumps/my-bumps` | List your connections |
| DELETE | `/bumps/{userId}` | Remove a connection |

## The bump mechanic

Bumping is how you connect on Stray. The iOS MVP now uses CoreBluetooth directly: while both users
have the Bump screen open, each phone advertises a small identity payload, scans for the Stray BLE
service, connects, reads the nearby identity, and measures RSSI. The Bump button unlocks at `-70 dBm`
or stronger, then the app records the connection through `POST /bumps` with method `ble`.

This is an MVP proximity signal, not a production trust boundary. A later hardening pass should use
server-issued, short-lived challenges with confirmation from both authenticated users. UWB / Nearby
Interaction is also a separate next phase; it is not part of the current BLE build.

The physical-device verification record, known limitations, and durable image-storage roadmap are
documented in the [BLE MVP test report](docs/ble-mvp-test-report.md).
