import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import tapsRoutes from '../src/routes/taps';
import { setupTestDb, createTestUser, createTestTap, getAuthToken } from './helpers';

const app = express();
app.use(express.json());
app.use('/taps', tapsRoutes);

describe('Taps Routes', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  describe('POST /taps', () => {
    it('should create a new tap', async () => {
      const user1 = await createTestUser({ username: 'alice', email: 'alice@test.com' });
      const user2 = await createTestUser({ username: 'bob', email: 'bob@test.com' });
      const token = getAuthToken(user1.id);

      const response = await request(app)
        .post('/taps')
        .set('Authorization', `Bearer ${token}`)
        .send({
          otherUserId: user2.id,
          method: 'manual',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.method).toBe('manual');
    });

    it('should reject tapping yourself', async () => {
      const user = await createTestUser({ username: 'alice', email: 'alice@test.com' });
      const token = getAuthToken(user.id);

      const response = await request(app)
        .post('/taps')
        .set('Authorization', `Bearer ${token}`)
        .send({
          otherUserId: user.id,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Cannot tap yourself');
    });

    it('should reject duplicate tap', async () => {
      const user1 = await createTestUser({ username: 'alice', email: 'alice@test.com' });
      const user2 = await createTestUser({ username: 'bob', email: 'bob@test.com' });
      await createTestTap(user1.id, user2.id);
      const token = getAuthToken(user1.id);

      const response = await request(app)
        .post('/taps')
        .set('Authorization', `Bearer ${token}`)
        .send({
          otherUserId: user2.id,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Already tapped');
    });

    it('should store tap metadata', async () => {
      const user1 = await createTestUser({ username: 'alice', email: 'alice@test.com' });
      const user2 = await createTestUser({ username: 'bob', email: 'bob@test.com' });
      const token = getAuthToken(user1.id);

      const response = await request(app)
        .post('/taps')
        .set('Authorization', `Bearer ${token}`)
        .send({
          otherUserId: user2.id,
          method: 'uwb',
          location: { lat: 40.7128, lng: -74.0060, name: 'NYC' },
          deviceInfo: { platform: 'ios', model: 'iPhone 15' },
        });

      expect(response.status).toBe(200);
      expect(response.body.method).toBe('uwb');
    });
  });

  describe('GET /taps/my-taps', () => {
    it('should return user connections', async () => {
      const user1 = await createTestUser({ username: 'alice', email: 'alice@test.com' });
      const user2 = await createTestUser({ username: 'bob', email: 'bob@test.com' });
      const user3 = await createTestUser({ username: 'charlie', email: 'charlie@test.com' });
      
      await createTestTap(user1.id, user2.id);
      await createTestTap(user1.id, user3.id);
      
      const token = getAuthToken(user1.id);

      const response = await request(app)
        .get('/taps/my-taps')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].user).toHaveProperty('username');
    });

    it('should not return inactive taps', async () => {
      const user1 = await createTestUser({ username: 'alice', email: 'alice@test.com' });
      const user2 = await createTestUser({ username: 'bob', email: 'bob@test.com' });
      
      await createTestTap(user1.id, user2.id, { active: false });
      
      const token = getAuthToken(user1.id);

      const response = await request(app)
        .get('/taps/my-taps')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });
  });

  describe('DELETE /taps/:userId', () => {
    it('should untap a user (soft delete)', async () => {
      const user1 = await createTestUser({ username: 'alice', email: 'alice@test.com' });
      const user2 = await createTestUser({ username: 'bob', email: 'bob@test.com' });
      
      await createTestTap(user1.id, user2.id);
      
      const token = getAuthToken(user1.id);

      const response = await request(app)
        .delete(`/taps/${user2.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify tap is now inactive
      const tapsResponse = await request(app)
        .get('/taps/my-taps')
        .set('Authorization', `Bearer ${token}`);

      expect(tapsResponse.body).toHaveLength(0);
    });
  });
});
