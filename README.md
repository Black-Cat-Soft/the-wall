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
│   ├── main.go       Router + all handlers
│   ├── db.go         Models + all SQL queries
│   ├── middleware.go  JWT auth middleware
│   └── schema.sql    Table definitions + seed data
├── mobile/           React Native (Expo Go)
│   └── src/
│       ├── config/   branding.ts — app name, copy, API URL
│       ├── context/  AuthContext
│       ├── lib/      api.ts, theme.ts, tapService.ts
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
go run .             # http://localhost:3000
```

Requires Go 1.22+ and a C compiler (for CGO/SQLite). On Mac, Xcode command line tools cover this:

```bash
xcode-select --install
```

The database is created automatically at `./data/app.db` on first run. Schema is applied via `schema.sql`. Seed users (alice + bob) are inserted via `INSERT OR IGNORE` in `schema.sql`.

### Mobile (Expo Go)

```bash
cd mobile
npx expo start
```

Scan the QR code with Expo Go on your phone. Phone and Mac must be on the same WiFi network.

**Set your local IP in `mobile/.env`:**

```
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
```

Find your IP with:
```bash
ipconfig getifaddr en0
```

Use `npx expo install` (not `npm install`) when adding new packages — it pins versions compatible with the current Expo SDK.

### Frontend (web)

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

## Test accounts

Seeded automatically on first backend run:

| Email | Password |
|-------|----------|
| alice@stray.dev | password123 |
| bob@stray.dev   | password123 |

Alice and Bob are already bumped.

## API

All protected routes require `Authorization: Bearer <token>`.

| Method | Path | Description |
|--------|------|-------------|
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

Bumping is how you connect on Stray. In production this will use BLE + UWB proximity detection — phones confirm they're physically close before creating a connection. For now it's stubbed: the bump screen simulates the flow on tap, and the profile page has a manual bump button for testing.
