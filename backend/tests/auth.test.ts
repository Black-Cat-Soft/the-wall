import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../src/routes/auth';
import { setupTestDb, createTestUser } from './helpers';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Auth Routes', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        username: 'testuser',
        email: 'test@example.com',
      });
      expect(response.body.user).toHaveProperty('id');
    });

    it('should reject duplicate username', async () => {
      await createTestUser({
        username: 'testuser',
        email: 'test1@example.com',
      });

      const response = await request(app)
        .post('/auth/register')
        .send({
          username: 'testuser',
          email: 'test2@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already taken');
    });

    it('should reject duplicate email', async () => {
      await createTestUser({
        username: 'testuser1',
        email: 'test@example.com',
      });

      const response = await request(app)
        .post('/auth/register')
        .send({
          username: 'testuser2',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already taken');
    });

    it('should require all fields', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          username: 'testuser',
          // missing email and password
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });
  });

  describe('POST /auth/login', () => {
    it('should login with correct credentials', async () => {
      await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        username: 'testuser',
        email: 'test@example.com',
      });
    });

    it('should reject wrong password', async () => {
      await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject non-existent email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid credentials');
    });
  });
});
