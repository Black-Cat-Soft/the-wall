# The Wall

A retro photo-sharing app where your network is built in person — not online. To connect with someone you have to physically meet them and tap phones. No search, no discovery, no algorithmic feed. Just photos from people you've actually met.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 19 + TypeScript + Vite |
| Backend  | Express 5 + TypeScript |
| Database | SQLite via Drizzle ORM |
| Auth     | JWT |
| Uploads  | multer → local `/uploads` |

## Project structure

```
the-wall/
├── backend/       Express API
│   ├── src/
│   │   ├── db/           Drizzle schema, migrations, seed
│   │   ├── middleware/   JWT auth
│   │   └── routes/       auth, posts, users, taps
│   ├── drizzle/          Migration files (committed)
│   └── drizzle.config.ts
└── frontend/      React SPA
    └── src/
        ├── components/   Navbar, PostCard, UploadModal
        ├── context/      AuthContext
        ├── lib/          API client
        └── pages/        Feed, Profile, Login, Register
```

## Local dev

### Backend

```bash
cd backend
npm install
npm run db:migrate   # create/update schema
npm run db:seed      # alice + bob test accounts
npm start            # http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

### Docker (both at once)

```bash
docker compose up
```

## Test accounts

After seeding:

| Email | Password |
|-------|----------|
| alice@thewall.dev | password123 |
| bob@thewall.dev   | password123 |

Alice and Bob are already tapped.

## Database

```bash
cd backend
npm run db:studio    # Drizzle Studio GUI at localhost:4983
npm run db:generate  # generate migration after schema changes
npm run db:migrate   # apply pending migrations
```

## Tests

```bash
cd backend
npm test             # vitest (in-memory SQLite)
```
