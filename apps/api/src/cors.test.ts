import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

describe('browser origins', () => {
  let app: Express;
  const primary = 'http://localhost:3000';
  const alternate = 'http://192.168.1.8:3000';

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      WEB_ORIGIN: primary,
      WEB_ORIGINS: alternate,
      DATABASE_URL: 'postgres://unused:unused@127.0.0.1:5432/unused',
      SESSION_SECRET: 'isolated-cors-test-secret-1234567890123',
      WHATSAPP_PHONE: '989120000000',
      TELEGRAM_USERNAME: 'gold_test',
      DEMO_GOLD_PRICE_TOMAN: '7240000',
      DEMO_SILVER_PRICE_TOMAN: '115000',
    });
    app = (await import('./app.js')).app;
  });

  it.each([primary, alternate])('permits a credentialed preflight from %s', async (origin) => {
    const response = await request(app)
      .options('/api/auth/otp/request')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not permit an unlisted origin', async () => {
    const response = await request(app)
      .options('/api/auth/otp/request')
      .set('Origin', 'https://untrusted.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('keeps the mutation origin guard aligned with CORS', async () => {
    const allowed = await request(app).post('/api/auth/otp/request').set('Origin', alternate).send({});
    const denied = await request(app).post('/api/auth/otp/request').set('Origin', 'https://untrusted.example').send({});
    expect(allowed.status).not.toBe(403);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('ORIGIN_DENIED');
  });
});
