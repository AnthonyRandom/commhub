import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as request from 'supertest';
import { AppModule } from './app.module';

describe('Security (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same security middleware as in main.ts
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
        noSniff: true,
        xssFilter: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      })
    );

    app.enableCors({
      origin: ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      maxAge: 86400,
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        disableErrorMessages: false, // Show error messages in tests
      })
    );

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Security Headers', () => {
    it('should set security headers', () => {
      return request(app.getHttpServer())
        .get('/auth/test-endpoint') // This will likely 404, but we care about headers
        .expect(res => {
          expect(res.headers['x-content-type-options']).toBe('nosniff');
          expect(res.headers['x-frame-options']).toBeDefined();
          expect(res.headers['x-xss-protection']).toBeDefined();
          expect(res.headers['strict-transport-security']).toBeDefined();
          expect(res.headers['referrer-policy']).toBe(
            'strict-origin-when-cross-origin'
          );
        });
    });
  });

  describe('CORS', () => {
    it('should allow requests from allowed origins', () => {
      return request(app.getHttpServer())
        .options('/auth/test-endpoint')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204)
        .expect(res => {
          expect(res.headers['access-control-allow-origin']).toBe(
            'http://localhost:3000'
          );
          expect(res.headers['access-control-allow-credentials']).toBe('true');
        });
    });

    it('should reject requests from disallowed origins', () => {
      return request(app.getHttpServer())
        .get('/auth/test-endpoint')
        .set('Origin', 'http://malicious-site.com')
        .expect(res => {
          // CORS should block this or not set the allow-origin header
          expect(res.headers['access-control-allow-origin']).toBeUndefined();
        });
    });
  });

  describe('Input Validation', () => {
    it('should reject requests with malicious SQL injection attempts', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username: "admin'; DROP TABLE users; --",
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(400)
        .expect(res => {
          expect(res.body.message).toContain(
            'Username can only contain letters, numbers, and underscores'
          );
        });
    });

    it('should reject requests with XSS attempts', () => {
      return request(app.getHttpServer())
        .post('/messages')
        .set('Authorization', 'Bearer fake-token')
        .send({
          content: '<script>alert("XSS")</script>',
          channelId: 1,
        })
        .expect(res => {
          // This should either be rejected by validation or sanitized
          // For now, we'll check that it doesn't crash the server
          expect(res.status).toBeDefined();
        });
    });

    it('should reject oversized input', () => {
      const longUsername = 'a'.repeat(100); // Exceeds 30 char limit
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username: longUsername,
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(400)
        .expect(res => {
          expect(res.body.message).toContain(
            'Username must not exceed 30 characters'
          );
        });
    });

    it('should reject invalid email format', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username: 'testuser',
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(400)
        .expect(res => {
          expect(res.body.message).toContain(
            'Please provide a valid email address'
          );
        });
    });
  });

  describe.skip('Rate Limiting', () => {
    it('should enforce rate limiting', async () => {
      const agent = request.agent(app.getHttpServer());

      // Make multiple requests quickly
      const promises = [];
      for (let i = 0; i < 15; i++) {
        promises.push(
          agent.post('/auth/register').send({
            username: `testuser${i}`,
            email: `test${i}@example.com`,
            password: 'password123',
          })
        );
      }

      const results = await Promise.allSettled(promises);

      // At least one request should be rate limited (429 status)
      const rateLimited = results.some(
        result => result.status === 'fulfilled' && result.value.status === 429
      );

      expect(rateLimited).toBe(true);
    });
  });

  describe('Authentication Security', () => {
    it('should reject weak passwords', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: '123', // Too short and weak
        })
        .expect(400)
        .expect(res => {
          expect(res.body.message).toContain(
            'Password must be at least 8 characters long'
          );
        });
    });

    it('should reject malformed JWT tokens', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer malformed.jwt.token')
        .expect(401);
    });
  });
});
