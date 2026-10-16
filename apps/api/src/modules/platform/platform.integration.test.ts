import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';

const testUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!testUrl)('asset-scoped gold platform on isolated PostgreSQL', () => {
  let app: Express;
  let pool: pg.Pool;
  let bootstrap: pg.Pool;
  let assetId: string;
  let gramId: string;
  const legacyUserId = randomUUID();
  const schema = `platform_test_${randomUUID().replaceAll('-', '')}`;
  const origin = 'http://localhost:3000';
  const secret = 'isolated-platform-test-secret-123456789';
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
      DEMO_OTP_ENABLED: 'true',
      DEMO_OTP_CODE: '123456',
      LEGACY_PASSWORD_AUTH_ENABLED: 'false',
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
    await pool.query(
      "INSERT INTO users(id,full_name,phone,password_hash,trusted) VALUES($1,'Legacy Owner','09999999999','unused',true)",
      [legacyUserId]
    );
    await pool.query('INSERT INTO gold_wallets(user_id,available_mg) VALUES($1,2500)', [
      legacyUserId,
    ]);
    await pool.query(
      "INSERT INTO app_settings(key,value) VALUES('gold_accounting_mode','demo:18k')"
    );
    await pool.query(
      await readFile(
        new URL('../../database/migrations/003_gold_platform.sql', import.meta.url),
        'utf8'
      )
    );
    app = (await import('../../app.js')).app;
    const admin = await actor('admin');
    const created = await post(admin, '/admin/gold-assets', {
      code: '750',
      name: 'Gold 750',
      purity: '750',
      buyTomanPerGram: 1000000,
      sellTomanPerGram: 900000,
    });
    expect(created.status).toBe(201);
    assetId = created.body.data.id;
    const catalog = await get(admin, '/gold-assets');
    gramId = catalog.body.data.units.find((unit: { code: string }) => unit.code === 'g').id;
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
      [id, 'Test Customer', phone, 'otp-only', role, trusted]
    );
    const token = jwt.sign({}, secret, {
      subject: id,
      expiresIn: '1h',
      issuer: 'sheri-gold',
      audience: 'gold-web',
      algorithm: 'HS256',
    });
    return { id, phone, cookie: `gold_session=${token}` };
  }
  const post = (user: { cookie: string }, path: string, body: object) =>
    request(app)
      .post(`/api/platform${path}`)
      .set('Origin', origin)
      .set('Cookie', user.cookie)
      .send(body);
  const get = (user: { cookie: string }, path: string) =>
    request(app).get(`/api/platform${path}`).set('Cookie', user.cookie);
  async function lock(user: { cookie: string }, side: 'buy' | 'sell', quantity: string) {
    const response = await post(user, '/price-locks', {
      side,
      assetId,
      unitId: gramId,
      quantity,
      idempotencyKey: randomUUID(),
    });
    expect(response.status).toBe(201);
    return response.body.data.id as string;
  }
  async function order(user: { cookie: string }, side: 'buy' | 'sell', quantity: string) {
    const priceLockId = await lock(user, side, quantity);
    const result = await post(user, '/orders', { priceLockId });
    expect(result.status).toBe(201);
    expect((await post(user, '/orders', { priceLockId })).body.data.id).toBe(result.body.data.id);
    return result.body.data.id as string;
  }
  async function sendReceipt(user: { cookie: string }, paymentId: string) {
    return request(app)
      .post(`/api/platform/payments/${paymentId}/receipts`)
      .set('Origin', origin)
      .set('Cookie', user.cookie)
      .set('Content-Type', 'image/png')
      .send(receipt);
  }
  it('signs in with a mock OTP, without exposing the code or allowing password login', async () => {
    const phone = '09' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
    const requested = await request(app)
      .post('/api/auth/otp/request')
      .set('Origin', origin)
      .send({ phone });
    expect(requested.status).toBe(200);
    expect(JSON.stringify(requested.body)).not.toContain('123456');
    expect(
      (
        await request(app)
          .post('/api/auth/otp/verify')
          .set('Origin', origin)
          .send({ phone, code: '000000', fullName: 'New Customer' })
      ).status
    ).toBe(401);
    const verified = await request(app)
      .post('/api/auth/otp/verify')
      .set('Origin', origin)
      .send({ phone, code: '123456', fullName: 'New Customer' });
    expect(verified.status).toBe(200);
    expect(verified.body.data.trusted).toBe(false);
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .set('Origin', origin)
          .send({ phone, password: 'anything' })
      ).status
    ).toBe(410);
  });
  it('imports settled legacy gold once and closes old trading writes', async () => {
    const imported = await pool.query(
      'SELECT a.available::text,a.held::text,g.purity FROM platform_accounts a JOIN gold_assets g ON g.id=a.asset_id WHERE a.user_id=$1',
      [legacyUserId]
    );
    expect(imported.rows[0]).toMatchObject({ available: '2500', held: '0', purity: '18k' });
    expect(
      (
        await pool.query(
          "SELECT * FROM platform_ledger WHERE account_id=(SELECT id FROM platform_accounts WHERE user_id=$1) AND action='legacy_opening'",
          [legacyUserId]
        )
      ).rowCount
    ).toBe(1);
    const legacy = await actor();
    const blocked = await request(app)
      .post('/api/trading/quotes')
      .set('Origin', origin)
      .set('Cookie', legacy.cookie)
      .send({ kind: 'buy', weightGrams: '1', idempotencyKey: randomUUID() });
    expect(blocked.status).toBe(410);
  });
  it('locks a server price and prevents expired or client-priced orders', async () => {
    const user = await actor();
    const key = randomUUID();
    const input = { side: 'buy', assetId, unitId: gramId, quantity: '1', idempotencyKey: key };
    const first = await post(user, '/price-locks', input);
    expect(first.body.data.total_toman).toBe('1000000');
    expect((await post(user, '/price-locks', input)).body.data.id).toBe(first.body.data.id);
    expect((await post(user, '/price-locks', { ...input, quantity: '2' })).body.error.code).toBe(
      'DUPLICATE_REQUEST'
    );
    await pool.query(
      "UPDATE platform_price_locks SET expires_at=now()-interval '1 second' WHERE id=$1",
      [first.body.data.id]
    );
    expect((await post(user, '/orders', { priceLockId: first.body.data.id })).body.error.code).toBe(
      'PRICE_LOCK_EXPIRED'
    );
    expect(
      (await post(user, '/orders', { priceLockId: first.body.data.id, totalToman: 1 })).status
    ).toBe(422);
  });
  it('settles a bank-funded buy once, then a sale once and credits cash', async () => {
    const user = await actor();
    const admin = await actor('admin');
    const buy = await order(user, 'buy', '1');
    const plan = await post(user, `/orders/${buy}/payments`, {
      walletToman: 0,
      bankToman: 1000000,
    });
    expect(plan.status).toBe(201);
    const paymentId = plan.body.data[0].id;
    expect((await sendReceipt(user, paymentId)).status).toBe(201);
    expect((await post(admin, `/admin/payments/${paymentId}/approve`, {})).status).toBe(200);
    expect((await post(admin, `/admin/orders/${buy}/approve`, {})).status).toBe(200);
    expect((await post(admin, `/admin/orders/${buy}/approve`, {})).status).toBe(200);
    const sell = await order(user, 'sell', '0.4');
    expect((await post(admin, `/admin/orders/${sell}/approve`, {})).status).toBe(200);
    const wallets = (await get(user, '/wallets')).body.data;
    expect(wallets.find((w: { kind: string }) => w.kind === 'cash').available).toBe('360000');
    expect(wallets.find((w: { kind: string }) => w.kind === 'gold').available).toBe('600');
    expect(
      (await pool.query('SELECT * FROM platform_ledger WHERE order_id=$1', [sell])).rowCount
    ).toBe(3);
    expect(
      (
        await pool.query(
          "SELECT * FROM platform_audit WHERE entity_id=$1 AND action='order_approve'",
          [sell]
        )
      ).rowCount
    ).toBe(1);
    const stranger = await actor();
    expect((await get(stranger, `/orders/${buy}`)).status).toBe(404);
    const receiptId = (await get(user, `/orders/${buy}`)).body.data.receipts[0].id;
    expect((await get(stranger, `/receipts/${receiptId}`)).status).toBe(404);
  });
  it('holds only the wallet part of a mixed payment and keeps rejected receipt history', async () => {
    const user = await actor();
    const admin = await actor('admin');
    await pool.query(
      "INSERT INTO platform_accounts(user_id,kind,available) VALUES($1,'cash',500000)",
      [user.id]
    );
    const buy = await order(user, 'buy', '1');
    const plan = await post(user, `/orders/${buy}/payments`, {
      walletToman: 200000,
      bankToman: 800000,
    });
    expect(plan.status).toBe(201);
    expect(
      (await get(user, '/wallets')).body.data.find((w: { kind: string }) => w.kind === 'cash')
    ).toMatchObject({ available: '300000', held: '200000' });
    const paymentId = plan.body.data.find(
      (p: { method: string }) => p.method === 'bank_transfer'
    ).id;
    expect((await post(admin, `/admin/orders/${buy}/approve`, {})).status).toBe(409);
    await sendReceipt(user, paymentId);
    expect(
      (await post(admin, `/admin/payments/${paymentId}/reject`, { reason: 'Unreadable receipt' }))
        .status
    ).toBe(200);
    const differentReceipt = Buffer.from(receipt);
    differentReceipt[40] = (differentReceipt[40] ?? 0) ^ 1;
    expect(
      (
        await request(app)
          .post(`/api/platform/payments/${paymentId}/receipts`)
          .set('Origin', origin)
          .set('Cookie', user.cookie)
          .set('Content-Type', 'image/png')
          .send(differentReceipt)
      ).status
    ).toBe(201);
    expect((await get(user, `/orders/${buy}`)).body.data.receipts).toHaveLength(2);
    expect((await post(admin, `/admin/payments/${paymentId}/approve`, {})).status).toBe(200);
    expect((await post(admin, `/admin/orders/${buy}/approve`, {})).status).toBe(200);
    expect(
      (await get(user, '/wallets')).body.data.find((w: { kind: string }) => w.kind === 'cash')
    ).toMatchObject({ available: '300000', held: '0' });
  });
  it('prevents concurrent sells and releases a rejected hold', async () => {
    const user = await actor();
    const admin = await actor('admin');
    const asset = await pool.query<{ id: string }>(
      "INSERT INTO platform_accounts(user_id,kind,asset_id,available) VALUES($1,'gold',$2,1000) RETURNING id",
      [user.id, assetId]
    );
    await pool.query(
      "INSERT INTO platform_ledger(account_id,action,available_delta) VALUES($1,'test_opening',1000)",
      [asset.rows[0]!.id]
    );
    const first = await lock(user, 'sell', '0.7');
    const second = await lock(user, 'sell', '0.7');
    const results = await Promise.all([
      post(user, '/orders', { priceLockId: first }),
      post(user, '/orders', { priceLockId: second }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const id = results.find((r) => r.status === 201)!.body.data.id;
    expect(
      (await post(admin, `/admin/orders/${id}/reject`, { reason: 'Cannot fulfill' })).status
    ).toBe(200);
    expect(
      (await get(user, '/wallets')).body.data.find((w: { kind: string }) => w.kind === 'gold')
    ).toMatchObject({ available: '1000', held: '0' });
  });
  it('holds and decides a withdrawal once', async () => {
    const user = await actor();
    const admin = await actor('admin');
    const cash = await pool.query<{ id: string }>(
      "INSERT INTO platform_accounts(user_id,kind,available) VALUES($1,'cash',500000) RETURNING id",
      [user.id]
    );
    await pool.query(
      "INSERT INTO platform_ledger(account_id,action,available_delta) VALUES($1,'test_opening',500000)",
      [cash.rows[0]!.id]
    );
    const bank = await post(user, '/bank-accounts', {
      iban: 'IR' + '1'.repeat(24),
      holderName: 'Test Customer',
    });
    const input = {
      bankAccountId: bank.body.data.id,
      amountToman: 200000,
      idempotencyKey: randomUUID(),
    };
    const first = await post(user, '/withdrawals', input);
    expect(first.status).toBe(201);
    expect(
      (await get(admin, '/admin/withdrawals')).body.data.find(
        (w: { id: string }) => w.id === first.body.data.id
      ).iban
    ).toBe('IR' + '1'.repeat(24));
    expect(
      (await get(user, '/withdrawals')).body.data.find(
        (w: { id: string }) => w.id === first.body.data.id
      ).iban
    ).toBeUndefined();
    expect((await post(user, '/withdrawals', input)).body.data.id).toBe(first.body.data.id);
    expect((await post(admin, `/admin/withdrawals/${first.body.data.id}/approve`, {})).status).toBe(
      422
    );
    expect(
      (
        await post(admin, `/admin/withdrawals/${first.body.data.id}/approve`, {
          payoutReference: 'bank-ref-123',
        })
      ).status
    ).toBe(200);
    expect(
      (
        await post(admin, `/admin/withdrawals/${first.body.data.id}/approve`, {
          payoutReference: 'bank-ref-123',
        })
      ).status
    ).toBe(200);
    expect(
      (
        await post(admin, `/admin/withdrawals/${first.body.data.id}/approve`, {
          payoutReference: 'different-ref',
        })
      ).status
    ).toBe(409);
    expect(
      (await get(user, '/wallets')).body.data.find((w: { kind: string }) => w.kind === 'cash')
    ).toMatchObject({ available: '300000', held: '0' });
  });
  it('expires correction windows and releases mixed-payment holds once', async () => {
    const user = await actor();
    const admin = await actor('admin');
    await pool.query(
      "INSERT INTO platform_accounts(user_id,kind,available) VALUES($1,'cash',200000)",
      [user.id]
    );
    const id = await order(user, 'buy', '1');
    const plan = await post(user, `/orders/${id}/payments`, {
      walletToman: 200000,
      bankToman: 800000,
    });
    const paymentId = plan.body.data.find(
      (p: { method: string }) => p.method === 'bank_transfer'
    ).id;
    await sendReceipt(user, paymentId);
    await post(admin, `/admin/payments/${paymentId}/reject`, { reason: 'Not legible' });
    await pool.query(
      "UPDATE platform_orders SET correction_deadline=now()-interval '1 second' WHERE id=$1",
      [id]
    );
    const { expireOrders } = await import('./platform.service.js');
    await expireOrders();
    await expireOrders();
    expect((await get(user, `/orders/${id}`)).body.data.state).toBe('expired');
    expect(
      (await get(user, '/wallets')).body.data.find((w: { kind: string }) => w.kind === 'cash')
    ).toMatchObject({ available: '200000', held: '0' });
    expect(
      (
        await pool.query(
          "SELECT * FROM platform_ledger WHERE order_id=$1 AND action='expired_release'",
          [id]
        )
      ).rowCount
    ).toBe(1);
    expect((await sendReceipt(user, paymentId)).status).toBe(409);
  });
});
