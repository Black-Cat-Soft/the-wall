# Testing Guide

## Overview

The backend uses **Vitest** and **Supertest** for testing. Tests run against an in-memory SQLite database for speed and isolation.

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

### Test Files

- **`tests/auth.test.ts`** - Authentication endpoints (register, login)
- **`tests/taps.test.ts`** - Tap/connection management
- **`tests/posts.test.ts`** - Post creation, feed, and likes

### Test Helpers

**`tests/helpers.ts`** provides utility functions:

- `setupTestDb()` - Initializes database schema for tests
- `createTestUser(data)` - Creates a test user
- `createTestTap(user1Id, user2Id, options?)` - Creates a tap between users
- `createTestPost(authorId, data?)` - Creates a test post
- `getAuthToken(userId)` - Generates a JWT token for testing authenticated routes

### Setup

**`tests/setup.ts`** runs before each test to clean the database by dropping all tables. This ensures test isolation.

## Test Coverage

### Auth Routes (`/auth`)

- ✅ User registration with validation
- ✅ Duplicate username/email rejection
- ✅ Login with correct credentials
- ✅ Login rejection with wrong password
- ✅ Login rejection for non-existent users

### Taps Routes (`/taps`)

- ✅ Creating new taps
- ✅ Rejecting self-taps
- ✅ Rejecting duplicate taps
- ✅ Storing tap metadata (method, location, device info)
- ✅ Fetching user connections
- ✅ Filtering inactive taps
- ✅ Soft-deleting taps (untapping)

### Posts Routes (`/posts`)

- ✅ Feed filtering (only tapped users + own posts)
- ✅ Empty feed with no connections
- ✅ Including author info and like counts
- ✅ Excluding posts from inactive taps
- ✅ Liking posts
- ✅ Unliking posts (toggle)

## Adding New Tests

1. Create a new test file in `tests/` directory
2. Import helpers and setup:
   ```typescript
   import { describe, it, expect, beforeEach } from 'vitest';
   import { setupTestDb, createTestUser, getAuthToken } from './helpers';
   
   describe('Your Feature', () => {
     beforeEach(async () => {
       await setupTestDb();
     });
     
     it('should do something', async () => {
       // Your test here
     });
   });
   ```

3. Use `supertest` to make HTTP requests:
   ```typescript
   const response = await request(app)
     .post('/endpoint')
     .set('Authorization', `Bearer ${token}`)
     .send({ data });
   
   expect(response.status).toBe(200);
   ```

## Configuration

- **`vitest.config.ts`** - Vitest configuration (uses in-memory database via `:memory:`)
- Database is automatically reset between tests
- All tests run in a single process for speed

## Notes

- Tests use an **in-memory SQLite database** (`:memory:`) for speed and isolation
- Each test gets a clean database state via `beforeEach` hooks
- JWT tokens are generated with the same secret as production for auth testing
- File uploads are mocked with placeholder paths
