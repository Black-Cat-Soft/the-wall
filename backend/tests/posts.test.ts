import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import postsRoutes from '../src/routes/posts';
import { setupTestDb, createTestUser, createTestTap, createTestPost, getAuthToken } from './helpers';

const app = express();
app.use(express.json());
app.use('/posts', postsRoutes);

describe('Posts Routes', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  describe('GET /posts/feed', () => {
    it('should return posts from tapped users', async () => {
      const user1 = await createTestUser({ username: 'alice', email: 'alice@test.com' });
      const user2 = await createTestUser({ username: 'bob', email: 'bob@test.com' });
      const user3 = await createTestUser({ username: 'charlie', email: 'charlie@test.com' });
      
      // User1 taps user2
      await createTestTap(user1.id, user2.id);
      
      // Create posts
      await createTestPost(user2.id, { caption: 'Bob post' });
      await createTestPost(user3.id, { caption: 'Charlie post' }); // Should not appear
      await createTestPost(user1.id, { caption: 'Alice own post' });
      
      const token = getAuthToken(user1.id);

      const response = await request(app)
        .get('/posts/feed')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2); // Only bob's and own post
      
      const captions = response.body.map((p: any) => p.caption);
      expect(captions).toContain('Bob post');
      expect(captions).toContain('Alice own post');
      expect(captions).not.toContain('Charlie post');
    });

    it('should return empty feed with no taps', async () => {
      const user = await createTestUser({ username: 'alice', email: 'alice@test.com' });
      const token = getAuthToken(user.id);

      const response = await request(app)
        .get('/posts/feed')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });

    it('should include author info and like counts', async () => {
      const user1 = await createTestUser({ username: 'alice', email: 'alice@test.com' });
      const user2 = await createTestUser({ username: 'bob', email: 'bob@test.com' });
      
      await createTestTap(user1.id, user2.id);
      await createTestPost(user2.id, { caption: 'Test post' });
      
      const token = getAuthToken(user1.id);

      const response = await request(app)
        .get('/posts/feed')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body[0]).toHaveProperty('author');
      expect(response.body[0].author.username).toBe('bob');
      expect(response.body[0]).toHaveProperty('likes');
      expect(response.body[0]).toHaveProperty('_count');
    });

    it('should not show posts from untapped users', async () => {
      const user1 = await createTestUser({ username: 'alice', email: 'alice@test.com' });
      const user2 = await createTestUser({ username: 'bob', email: 'bob@test.com' });
      
      // Create inactive tap
      await createTestTap(user1.id, user2.id, { active: false });
      await createTestPost(user2.id, { caption: 'Bob post' });
      
      const token = getAuthToken(user1.id);

      const response = await request(app)
        .get('/posts/feed')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0); // No posts from inactive tap
    });
  });

  describe('POST /posts/:id/like', () => {
    it('should like a post', async () => {
      const user1 = await createTestUser({ username: 'alice', email: 'alice@test.com' });
      const user2 = await createTestUser({ username: 'bob', email: 'bob@test.com' });
      const post = await createTestPost(user2.id);
      
      const token = getAuthToken(user1.id);

      const response = await request(app)
        .post(`/posts/${post.id}/like`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.liked).toBe(true);
    });

    it('should unlike a post', async () => {
      const user1 = await createTestUser({ username: 'alice', email: 'alice@test.com' });
      const user2 = await createTestUser({ username: 'bob', email: 'bob@test.com' });
      const post = await createTestPost(user2.id);
      const token = getAuthToken(user1.id);

      // Like
      await request(app)
        .post(`/posts/${post.id}/like`)
        .set('Authorization', `Bearer ${token}`);

      // Unlike
      const response = await request(app)
        .post(`/posts/${post.id}/like`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.liked).toBe(false);
    });
  });
});
