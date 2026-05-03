import { beforeEach } from 'vitest';
import db from '../src/db';
import { sql } from 'drizzle-orm';

beforeEach(async () => {
  // Clear all tables before each test
  await db.run(sql`DROP TABLE IF EXISTS likes`);
  await db.run(sql`DROP TABLE IF EXISTS taps`);
  await db.run(sql`DROP TABLE IF EXISTS posts`);
  await db.run(sql`DROP TABLE IF EXISTS users`);
  await db.run(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
});
