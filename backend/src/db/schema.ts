import { sqliteTable, integer, text, unique, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  avatar: text('avatar'),
  bio: text('bio'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Posts table
export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  imageUrl: text('image_url').notNull(),
  caption: text('caption').notNull().default(''),
  authorId: integer('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  authorIdx: index('posts_author_idx').on(table.authorId),
}));

// Taps table (mutual connections)
export const taps = sqliteTable('taps', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user1Id: integer('user1_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  user2Id: integer('user2_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tappedAt: integer('tapped_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  tappedVia: text('tapped_via').notNull().default('manual'), // 'manual' | 'qr' | 'uwb' | 'nfc'
  location: text('location', { mode: 'json' }).$type<{ lat: number; lng: number; name?: string }>(),
  deviceInfo: text('device_info', { mode: 'json' }).$type<{ platform: string; model?: string }>(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
}, (table) => ({
  userPairUnique: unique().on(table.user1Id, table.user2Id),
  user1Idx: index('taps_user1_idx').on(table.user1Id),
  user2Idx: index('taps_user2_idx').on(table.user2Id),
}));

// Likes table
export const likes = sqliteTable('likes', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  pk: unique().on(table.userId, table.postId),
  userIdx: index('likes_user_idx').on(table.userId),
  postIdx: index('likes_post_idx').on(table.postId),
}));

// Type exports for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export type Tap = typeof taps.$inferSelect;
export type NewTap = typeof taps.$inferInsert;

export type Like = typeof likes.$inferSelect;
export type NewLike = typeof likes.$inferInsert;
