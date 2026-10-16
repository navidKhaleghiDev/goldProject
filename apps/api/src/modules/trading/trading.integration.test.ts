import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import type { Actor } from '../auth/auth.js';

const testUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!testUrl)('gold flow on isolated PostgreSQL', () => {
  let app: Express;
  let pool: pg.Pool;
  let bootstrap: pg.Pool;
  const schema = `gold_test_${randomUUID().replaceAll('-', '')}`;
  const origin = 'http://localhost:3000';
  const secret = 'isolated-integration-test-secret-123456789';
  const receipt = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGmQAAAAASUVORK5CYII=',
    'base64'
  );
  beforeAll(async () => {
    if (!testUrl || !new URL(testUrl).pathname.endsWith('_test'))
      throw new Error('TEST_DATABASE_URL must target an isolated database ending in _test');
    bootstrap = new pg.Pool({ connectionString: testUrl });
    await bootstrap.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(testUrl);
    scoped.searchParams.set('options', `-c search_path=${schema},public`);
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: scoped.toString(),
      SESSION_SECRET: secret,
      WEB_ORIGIN: origin,
      DEMO_OTP_ENABLED: 'false',
      LEGACY_PASSWORD_AUTH_ENABLED: 'true',
      TRADING_DEMO_ENABLED: 'true',
      WHATSAPP_PHONE: '989120000000',
      TELEGRAM_USERNAME: 'gold_test',
      DEMO_GOLD_PRICE_TOMAN: '7240000',
      DEMO_SILVER_PRICE_TOMAN: '115000',
      RECEIPT_DIRECTORY: resolve('..', '..', 'tmp', schema, 'receipts'),
    });
    pool = (await import('../../database/pool.js')).pool;
    for (const name of ['001_initial.sql', '002_gold_trading.sql'])
      await pool.query(
        await readFile(new URL(`../../database/migrations/${name}`, import.meta.url), 'utf8')
      );
    app = (await import('../../app.js')).app;
  }, 30000);
  afterAll(async () => {
    await pool?.end();
    if (bootstrap) {
      await bootstrap.query(`DROP SCHEMA ${schema} CASCADE`);
      await bootstrap.end();
    }
  });
  async function actor(role: 'customer' | 'admin' = 'customer', trusted = true) {
    const id = randomUUID();
    const phone = '09' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
    await pool.query(
      'INSERT INTO users(id,full_name,phone,password_hash,role,trusted) VALUES($1,$2,$3,$4,$5,$6)',
      [id, 'Test Customer', phone, 'unused', role, trusted]
    );
    const token = jwt.sign({}, secret, {
      subject: id,
      expiresIn: '1h',
      issuer: 'sheri-gold',
      audience: 'gold-web',
      algorithm: 'HS256',
    });
    return { id, cookie: `gold_session=${token}`, role, phone, fullName: 'Test Customer', trusted };
  }
  function post(user: { cookie: string }, path: string, body: object) {
    return request(app)
      .post(`/api/trading${path}`)
      .set('Origin', origin)
      .set('Cookie', user.cookie)
      .send(body);
  }
  async function quote(user: { cookie: string }, kind: 'buy' | 'sell', weight = '10') {
    const result = await post(user, '/quotes', {
      kind,
      weightGrams: weight,
      idempotencyKey: randomUUID(),
    });
    expect(result.status).toBe(201);
    return result.body.data.id as string;
  }
  async function trade(user: { cookie: string }, kind: 'buy' | 'sell', weight = '10') {
    const q = await quote(user, kind, weight);
    const response = await post(user, '/transactions', { quoteId: q });
    expect(response.status).toBe(201);
    return response.body.data.id as string;
  }
  async function wallet(user: { cookie: string }) {
    const response = await request(app).get('/api/trading/wallet').set('Cookie', user.cookie);
    expect(response.status).toBe(200);
    return response.body.data;
  }
  async function upload(user: { cookie: string }, id: string) {
    return request(app)
      .post(`/api/trading/transactions/${id}/receipt`)
      .set('Origin', origin)
      .set('Cookie', user.cookie)
      .set('Content-Type', 'image/png')
      .send(receipt);
  }
  async function holding(user: Actor, mg = 10000) {
    await pool.query('INSERT INTO gold_wallets(user_id,available_mg) VALUES($1,$2)', [user.id, mg]);
  }
  it('requires authentication, trust, role, and same-origin mutation', async () => {
    const user = await actor('customer', false);
    expect((await request(app).get('/api/trading/wallet')).status).toBe(401);
    expect(
      (await post(user, '/quotes', { kind: 'buy', weightGrams: '1', idempotencyKey: randomUUID() }))
        .status
    ).toBe(403);
    expect(
      (await request(app).get('/api/trading/customers').set('Cookie', user.cookie)).status
    ).toBe(403);
    expect(
      (await request(app).post('/api/trading/quotes').set('Cookie', user.cookie).send({})).status
    ).toBe(403);
  });
  it('supports registration, login, and administrator trust approval', async () => {
    const phone = '09' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
    expect(
      (
        await request(app)
          .post('/api/auth/register')
          .set('Origin', origin)
          .send({ fullName: 'New Customer', phone, password: 'TestPassword123!' })
      ).status
    ).toBe(201);
    const login = await request(app)
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ phone, password: 'TestPassword123!' });
    expect(login.status).toBe(200);
    expect(login.body.data.trusted).toBe(false);
    expect(login.body.data).not.toHaveProperty('password_hash');
    const admin = await actor('admin');
    expect(
      (
        await request(app)
          .patch(`/api/trading/customers/${login.body.data.id}`)
          .set('Origin', origin)
          .set('Cookie', admin.cookie)
          .send({ trusted: true })
      ).status
    ).toBe(200);
    expect(
      (
        await pool.query('SELECT * FROM customer_trust_events WHERE user_id=$1', [
          login.body.data.id,
        ])
      ).rowCount
    ).toBe(1);
  });
  it('buys through receipt and review, credits exactly once and preserves history', async () => {
    const user = await actor();
    const admin = await actor('admin');
    const q = await quote(user, 'buy');
    const first = await post(user, '/transactions', { quoteId: q });
    const id = first.body.data.id;
    expect((await post(user, '/transactions', { quoteId: q })).body.data.id).toBe(id);
    expect(
      (await post(admin, `/transactions/${id}/decision`, { decision: 'approve' })).status
    ).toBe(409);
    expect((await upload(user, id)).status).toBe(200);
    expect((await upload(user, id)).status).toBe(200);
    expect((await post(admin, `/transactions/${id}/review`, {})).status).toBe(200);
    const decisions = await Promise.all([
      post(admin, `/transactions/${id}/decision`, { decision: 'approve' }),
      post(admin, `/transactions/${id}/decision`, { decision: 'approve' }),
    ]);
    expect(decisions.map((r) => r.status)).toEqual([200, 200]);
    expect(await wallet(user)).toEqual({ availableMg: 10000, frozenMg: 0 });
    const detail = await request(app)
      .get(`/api/trading/transactions/${id}`)
      .set('Cookie', user.cookie);
    expect(detail.body.data.history.map((e: { status: string }) => e.status)).toEqual([
      'price_locked',
      'awaiting_payment',
      'payment_submitted',
      'admin_review',
      'completed',
    ]);
    expect(
      (await pool.query('SELECT * FROM gold_ledger WHERE transaction_id=$1', [id])).rowCount
    ).toBe(1);
  });
  it('rejects an expired quote and conflicting idempotency payload', async () => {
    const user = await actor();
    const key = randomUUID();
    const input = { kind: 'buy', weightGrams: '1', idempotencyKey: key };
    const q = await post(user, '/quotes', input);
    expect((await post(user, '/quotes', input)).body.data.id).toBe(q.body.data.id);
    expect((await post(user, '/quotes', { ...input, weightGrams: '2' })).status).toBe(409);
    await pool.query("UPDATE gold_quotes SET expires_at=now()-interval '1 second' WHERE id=$1", [
      q.body.data.id,
    ]);
    expect((await post(user, '/transactions', { quoteId: q.body.data.id })).body.error.code).toBe(
      'QUOTE_EXPIRED'
    );
  });
  it('prevents two concurrent sales consuming the same gold and rolls back the loser', async () => {
    const user = await actor();
    await holding(user);
    const q1 = await quote(user, 'sell', '7');
    const q2 = await quote(user, 'sell', '7');
    const responses = await Promise.all([
      post(user, '/transactions', { quoteId: q1 }),
      post(user, '/transactions', { quoteId: q2 }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await wallet(user)).toEqual({ availableMg: 3000, frozenMg: 7000 });
    expect(
      (await pool.query('SELECT * FROM gold_transactions WHERE user_id=$1', [user.id])).rowCount
    ).toBe(1);
    expect(
      (await pool.query('SELECT * FROM gold_ledger WHERE user_id=$1', [user.id])).rowCount
    ).toBe(1);
  });
  it('releases frozen gold once on rejection and requires a reason', async () => {
    const user = await actor();
    const admin = await actor('admin');
    await holding(user);
    const id = await trade(user, 'sell', '4');
    expect(
      (await post(admin, `/transactions/${id}/decision`, { decision: 'reject', reason: '' })).status
    ).toBe(422);
    expect(await wallet(user)).toEqual({ availableMg: 6000, frozenMg: 4000 });
    for (let i = 0; i < 2; i++)
      expect(
        (
          await post(admin, `/transactions/${id}/decision`, {
            decision: 'reject',
            reason: 'Settlement unavailable',
          })
        ).status
      ).toBe(200);
    expect(await wallet(user)).toEqual({ availableMg: 10000, frozenMg: 0 });
    expect(
      (
        await post(admin, `/transactions/${id}/decision`, {
          decision: 'approve',
          acknowledgement: 'paid',
        })
      ).status
    ).toBe(409);
  });
  it('requires settlement acknowledgement before consuming frozen gold', async () => {
    const user = await actor();
    const admin = await actor('admin');
    await holding(user);
    const id = await trade(user, 'sell', '3');
    expect(
      (await post(admin, `/transactions/${id}/decision`, { decision: 'approve' })).body.error.code
    ).toBe('SETTLEMENT_REQUIRED');
    expect(await wallet(user)).toEqual({ availableMg: 7000, frozenMg: 3000 });
    expect(
      (
        await post(admin, `/transactions/${id}/decision`, {
          decision: 'approve',
          acknowledgement: 'Bank transfer ref 123',
        })
      ).status
    ).toBe(200);
    expect(await wallet(user)).toEqual({ availableMg: 7000, frozenMg: 0 });
  });
  it('denies another customer access to transaction and receipt', async () => {
    const user = await actor();
    const stranger = await actor();
    const id = await trade(user, 'buy');
    expect(
      (await request(app).get(`/api/trading/transactions/${id}`).set('Cookie', stranger.cookie))
        .status
    ).toBe(404);
    expect((await upload(stranger, id)).status).toBe(404);
    await upload(user, id);
    expect(
      (
        await request(app)
          .get(`/api/trading/transactions/${id}/receipt`)
          .set('Cookie', stranger.cookie)
      ).status
    ).toBe(404);
    expect(
      (await request(app).get(`/api/trading/transactions/${id}/receipt`).set('Cookie', user.cookie))
        .status
    ).toBe(200);
  });
  it('retains late receipts for reconciliation and rejection never credits gold', async () => {
    const user = await actor();
    const admin = await actor('admin');
    const id = await trade(user, 'buy');
    await pool.query(
      "UPDATE gold_quotes SET expires_at=now()-interval '1 second' WHERE id=(SELECT quote_id FROM gold_transactions WHERE id=$1)",
      [id]
    );
    expect((await upload(user, id)).status).toBe(200);
    expect(
      (await pool.query('SELECT late_payment FROM gold_transactions WHERE id=$1', [id])).rows[0]
        .late_payment
    ).toBe(true);
    await post(admin, `/transactions/${id}/review`, {});
    await post(admin, `/transactions/${id}/decision`, {
      decision: 'reject',
      reason: 'Payment requires offline refund',
    });
    expect(await wallet(user)).toEqual({ availableMg: 0, frozenMg: 0 });
  });
});
