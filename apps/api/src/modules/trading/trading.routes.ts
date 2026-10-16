import express, { Router } from 'express';
import { resolve } from 'node:path';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { pool } from '../../database/pool.js';
import { AppError } from '../../shared/app-error.js';
import { authenticate, administrator, originGuard, type Actor } from '../auth/auth.js';
import { getRates } from './trading.rates.js';
import {
  acceptQuote,
  beginReview,
  createQuote,
  decide,
  uploadReceipt,
  uuid,
} from './trading.service.js';
import { tradeSelect, transaction } from './trading.repository.js';
export const tradingRouter = Router();
tradingRouter.use(originGuard, authenticate);
tradingRouter.use(async (request, _response, next) => {
  if (request.method === 'GET' || !/^\/(quotes|transactions)(\/|$)/.test(request.path))
    return next();
  const migrated = await pool.query("SELECT to_regclass('platform_accounts') IS NOT NULL AS ready");
  if (migrated.rows[0]?.ready)
    return next(new AppError(410, 'LEGACY_TRADING_CLOSED', 'Use the updated gold trading flow'));
  next();
});
tradingRouter.use(
  rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false })
);
tradingRouter.use((_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});
tradingRouter.get('/rates', async (_request, response) =>
  response.json({ success: true, data: await getRates() })
);
tradingRouter.get('/wallet', async (_request, response) => {
  const result = await pool.query(
    'SELECT available_mg::float8 AS "availableMg",frozen_mg::float8 AS "frozenMg" FROM gold_wallets WHERE user_id=$1',
    [(response.locals.actor as Actor).id]
  );
  response.json({ success: true, data: result.rows[0] ?? { availableMg: 0, frozenMg: 0 } });
});
tradingRouter.post('/quotes', async (request, response) =>
  response
    .status(201)
    .json({ success: true, data: await createQuote(response.locals.actor, request.body) })
);
tradingRouter.post('/transactions', async (request, response) => {
  const body = z.object({ quoteId: uuid }).strict().parse(request.body);
  response
    .status(201)
    .json({ success: true, data: await acceptQuote(response.locals.actor, body.quoteId) });
});
tradingRouter.get('/transactions', async (request, response) => {
  const page = z.coerce.number().int().min(1).max(10000).default(1).parse(request.query.page);
  const actor = response.locals.actor as Actor;
  const rows = await pool.query(
    `${tradeSelect} WHERE ($1::boolean OR t.user_id=$2) ORDER BY t.created_at DESC,t.id DESC LIMIT 30 OFFSET $3`,
    [actor.role === 'admin', actor.id, (page - 1) * 30]
  );
  response.json({ success: true, data: rows.rows });
});
tradingRouter.get('/transactions/:id', async (request, response) => {
  const actor = response.locals.actor as Actor;
  const result = await pool.query(
    `${tradeSelect} WHERE t.id=$1 AND ($2::boolean OR t.user_id=$3)`,
    [uuid.parse(request.params.id), actor.role === 'admin', actor.id]
  );
  if (!result.rows[0]) throw new AppError(404, 'NOT_FOUND', 'معامله پیدا نشد.');
  response.json({ success: true, data: result.rows[0] });
});
tradingRouter.post(
  '/transactions/:id/receipt',
  express.raw({ type: ['image/png', 'image/jpeg'], limit: '5mb' }),
  async (request, response) => {
    if (!Buffer.isBuffer(request.body))
      throw new AppError(422, 'INVALID_RECEIPT', 'تصویر رسید را انتخاب کنید.');
    response.json({
      success: true,
      data: await uploadReceipt(response.locals.actor, uuid.parse(request.params.id), request.body),
    });
  }
);
tradingRouter.get('/transactions/:id/receipt', async (request, response) => {
  const actor = response.locals.actor as Actor;
  const result = await pool.query(
    'SELECT receipt_key,receipt_mime FROM gold_transactions WHERE id=$1 AND ($2::boolean OR user_id=$3)',
    [uuid.parse(request.params.id), actor.role === 'admin', actor.id]
  );
  const row = result.rows[0];
  if (!row?.receipt_key) throw new AppError(404, 'NOT_FOUND', 'رسید پیدا نشد.');
  response
    .type(row.receipt_mime)
    .set('Content-Disposition', 'inline; filename="receipt"')
    .sendFile(resolve(env.RECEIPT_DIRECTORY, uuid.parse(row.receipt_key)));
});
tradingRouter.post('/transactions/:id/review', administrator, async (request, response) =>
  response.json({
    success: true,
    data: await beginReview(response.locals.actor, uuid.parse(request.params.id)),
  })
);
tradingRouter.post('/transactions/:id/decision', administrator, async (request, response) =>
  response.json({
    success: true,
    data: await decide(response.locals.actor, uuid.parse(request.params.id), request.body),
  })
);
tradingRouter.get('/customers', administrator, async (request, response) => {
  const page = z.coerce.number().int().min(1).max(10000).default(1).parse(request.query.page);
  const result = await pool.query(
    `SELECT id,full_name AS "fullName",phone,role,trusted FROM users WHERE role='customer' ORDER BY created_at DESC,id LIMIT 30 OFFSET $1`,
    [(page - 1) * 30]
  );
  response.json({ success: true, data: result.rows });
});
tradingRouter.patch('/customers/:id', administrator, async (request, response) => {
  const input = z.object({ trusted: z.boolean() }).strict().parse(request.body);
  const id = uuid.parse(request.params.id);
  await transaction(async (client) => {
    const result = await client.query(
      `UPDATE users SET trusted=$2,updated_at=now() WHERE id=$1 AND role='customer' RETURNING id`,
      [id, input.trusted]
    );
    if (!result.rowCount) throw new AppError(404, 'NOT_FOUND', 'مشتری پیدا نشد.');
    await client.query(
      'INSERT INTO customer_trust_events(user_id,actor_id,trusted) VALUES($1,$2,$3)',
      [id, (response.locals.actor as Actor).id, input.trusted]
    );
  });
  response.json({ success: true, data: { id, ...input } });
});
