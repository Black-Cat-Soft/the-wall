import bcrypt from 'bcrypt';
import db from '../src/db';
import { users, taps, posts } from '../src/db/schema';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

export async function setupTestDb() {
  // Run migrations on in-memory database
  await migrate(db, { migrationsFolder: './drizzle' });
}

export async function createTestUser(data: { 
  username: string; 
  email: string; 
  password?: string; 
  bio?: string;
}) {
  const password = await bcrypt.hash(data.password || 'password123', 10);
  const [user] = await db.insert(users).values({
    username: data.username,
    email: data.email,
    password,
    bio: data.bio,
  }).returning();
  
  return user;
}

export async function createTestTap(user1Id: number, user2Id: number, options?: {
  tappedVia?: string;
  active?: boolean;
}) {
  const [userId1, userId2] = user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];
  
  const [tap] = await db.insert(taps).values({
    user1Id: userId1,
    user2Id: userId2,
    tappedVia: options?.tappedVia || 'manual',
    active: options?.active !== undefined ? options.active : true,
  }).returning();
  
  return tap;
}

export async function createTestPost(authorId: number, data?: {
  caption?: string;
  imageUrl?: string;
}) {
  const [post] = await db.insert(posts).values({
    authorId,
    imageUrl: data?.imageUrl || '/uploads/test-image.jpg',
    caption: data?.caption || 'Test post',
  }).returning();
  
  return post;
}

export function getAuthToken(userId: number): string {
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_prod';
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}
