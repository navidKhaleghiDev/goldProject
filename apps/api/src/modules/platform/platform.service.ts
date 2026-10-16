import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool } from '../../database/pool.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/app-error.js';
import type { Actor } from '../auth/auth.js';
import { receiptType } from '../trading/trading.rules.js';
import { transaction } from '../trading/trading.repository.js';
import { pricingProvider } from './platform.pricing.js';

const uuid = z.string().uuid();
const quantity = z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/);
const money = z.number().int().positive().safe();
const bankKey = env.BANK_ACCOUNT_ENCRYPTION_KEY ?? env.SESSION_SECRET;
function fail(code: string, message: string, status = 409): never {
  throw new AppError(status, code, message);
}
const requireCustomer = (actor: Actor) => {
  if (actor.role !== 'customer' || !actor.trusted)
    fail('TRUST_REQUIRED', 'Customer approval is required', 403);
};
async function requireTrustedTx(client: PoolClient, actor: Actor) {
  const row = await client.query<{ trusted: boolean; role: string }>(
    'SELECT trusted,role FROM users WHERE id=$1 FOR SHARE',
    [actor.id]
  );
  if (row.rows[0]?.role !== 'customer' || !row.rows[0].trusted)
    fail('TRUST_REQUIRED', 'Customer approval is required', 403);
}
const mgOf = (input: string, factor: bigint) => {
  const [whole, fraction = ''] = input.split('.');
  const numerator = BigInt(whole!) * 1000n + BigInt(fraction.padEnd(3, '0'));
  const product = numerator * factor;
  if (product % 1000n !== 0n || product <= 0n || product > 1000000000n)
    fail('INVALID_QUANTITY', 'Quantity must resolve to whole milligrams', 422);
  return product / 1000n;
};
const asMoney = (value: bigint) => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER))
    fail('AMOUNT_LIMIT', 'Amount exceeds the supported limit', 422);
  return Number(value);
};
type Account = { id: string; available: string; held: string };
type Lock = {
  id: string;
  user_id: string;
  asset_id: string;
  side: 'buy' | 'sell';
  quantity_mg: string;
  total_toman: string;
  expires_at: Date;
};
type Order = {
  id: string;
  user_id: string;
  state: string;
  correction_deadline: Date | null;
  payment_deadline: Date | null;
  rejection_reason: string | null;
  side: 'buy' | 'sell';
  asset_id: string;
  quantity_mg: string;
  total_toman: string;
  expires_at: Date;
};

async function account(client: PoolClient, user: string, kind: 'cash' | 'gold', assetId?: string) {
  if (kind === 'cash')
    await client.query(
      "INSERT INTO platform_accounts(user_id,kind) VALUES($1,'cash') ON CONFLICT DO NOTHING",
      [user]
    );
  else
    await client.query(
      "INSERT INTO platform_accounts(user_id,kind,asset_id) VALUES($1,'gold',$2) ON CONFLICT DO NOTHING",
      [user, assetId]
    );
  const row = await client.query<Account>(
    `SELECT id,available::text,held::text FROM platform_accounts WHERE user_id=$1 AND kind=$2 AND ${kind === 'cash' ? 'asset_id IS NULL' : 'asset_id=$3'} FOR UPDATE`,
    kind === 'cash' ? [user, kind] : [user, kind, assetId]
  );
  return row.rows[0]!;
}
async function movement(
  client: PoolClient,
  a: Account,
  available: bigint,
  held: bigint,
  action: string,
  orderId?: string,
  withdrawalId?: string
) {
  if (BigInt(a.available) + available < 0n || BigInt(a.held) + held < 0n)
    fail(a.id ? 'INSUFFICIENT_BALANCE' : 'INVALID_ACCOUNT', 'Insufficient available balance');
  if (
    BigInt(a.available) + available > BigInt(Number.MAX_SAFE_INTEGER) ||
    BigInt(a.held) + held > BigInt(Number.MAX_SAFE_INTEGER)
  )
    fail('AMOUNT_LIMIT', 'Balance exceeds the supported limit', 422);
  await client.query(
    'UPDATE platform_accounts SET available=available+$2,held=held+$3,version=version+1 WHERE id=$1',
    [a.id, available.toString(), held.toString()]
  );
  await client.query(
    'INSERT INTO platform_ledger(account_id,order_id,withdrawal_id,action,available_delta,held_delta) VALUES($1,$2,$3,$4,$5,$6)',
    [a.id, orderId ?? null, withdrawalId ?? null, action, available.toString(), held.toString()]
  );
  a.available = (BigInt(a.available) + available).toString();
  a.held = (BigInt(a.held) + held).toString();
}
async function audit(
  client: PoolClient,
  actorId: string | null,
  action: string,
  type: string,
  id: string,
  requestId?: string,
  details: object = {}
) {
  await client.query(
    'INSERT INTO platform_audit(actor_id,action,entity_type,entity_id,request_id,details) VALUES($1,$2,$3,$4,$5,$6)',
    [actorId, action, type, id, requestId ?? null, JSON.stringify(details)]
  );
}
async function lockedOrder(client: PoolClient, id: string, user?: string) {
  const result = await client.query<Order>(
    `SELECT o.id,o.user_id,o.state,o.correction_deadline,o.payment_deadline,o.rejection_reason,l.side,l.asset_id,l.quantity_mg::text,l.total_toman::text,l.expires_at FROM platform_orders o JOIN platform_price_locks l ON l.id=o.price_lock_id WHERE o.id=$1 ${user ? 'AND o.user_id=$2' : ''} FOR UPDATE OF o`,
    user ? [id, user] : [id]
  );
  if (!result.rows[0]) fail('NOT_FOUND', 'Order not found', 404);
  return result.rows[0]!;
}
async function release(client: PoolClient, o: Order, state: 'expired' | 'rejected') {
  const rows = await client.query<{ id: string; account_id: string; amount: string }>(
    "SELECT id,account_id,amount::text FROM platform_reservations WHERE order_id=$1 AND state='active' FOR UPDATE",
    [o.id]
  );
  for (const r of rows.rows) {
    const a = (
      await client.query<Account>(
        'SELECT id,available::text,held::text FROM platform_accounts WHERE id=$1 FOR UPDATE',
        [r.account_id]
      )
    ).rows[0]!;
    await movement(client, a, BigInt(r.amount), -BigInt(r.amount), `${state}_release`, o.id);
    await client.query("UPDATE platform_reservations SET state='released' WHERE id=$1", [r.id]);
  }
  await client.query('UPDATE platform_orders SET state=$2,updated_at=now() WHERE id=$1', [
    o.id,
    state,
  ]);
  await client.query(
    "UPDATE platform_payments SET state='released' WHERE order_id=$1 AND state IN ('held','pending_receipt','review','rejected')",
    [o.id]
  );
  o.state = state;
}
async function expireIfNeeded(client: PoolClient, o: Order) {
  if (['completed', 'expired', 'rejected'].includes(o.state)) return;
  const now = Date.now();
  if (
    (o.state === 'pending_payment' && o.payment_deadline && o.payment_deadline.getTime() <= now) ||
    (o.state === 'correction_window' &&
      o.correction_deadline &&
      o.correction_deadline.getTime() <= now)
  )
    await release(client, o, 'expired');
}
export async function expireOrders(limit = 100) {
  const ids = await pool.query<{ id: string }>(
    `SELECT o.id FROM platform_orders o WHERE (o.state='pending_payment' AND o.payment_deadline<=now()) OR (o.state='correction_window' AND o.correction_deadline<=now()) ORDER BY o.created_at LIMIT $1`,
    [limit]
  );
  for (const row of ids.rows)
    await transaction(async (client) => expireIfNeeded(client, await lockedOrder(client, row.id)));
  return ids.rowCount ?? 0;
}
export async function assets() {
  const result = await pool.query(
    `SELECT a.id,a.code,a.name,a.purity,a.active,p.buy_toman_per_gram::float8 AS "buyTomanPerGram",p.sell_toman_per_gram::float8 AS "sellTomanPerGram" FROM gold_assets a LEFT JOIN gold_mock_prices p ON p.asset_id=a.id WHERE a.active ORDER BY a.code`
  );
  const units = await pool.query(
    'SELECT id,code,name,milligrams_per_unit::text AS "milligramsPerUnit" FROM gold_units ORDER BY milligrams_per_unit'
  );
  return { assets: result.rows, units: units.rows, isDemo: env.TRADING_DEMO_ENABLED };
}
export async function upsertAsset(actor: Actor, body: unknown, requestId?: string) {
  const input = z
    .object({
      code: z
        .string()
        .trim()
        .regex(/^[a-z0-9_-]{2,20}$/),
      name: z.string().trim().min(2).max(80),
      purity: z.string().trim().min(2).max(30),
      buyTomanPerGram: money,
      sellTomanPerGram: money,
    })
    .strict()
    .parse(body);
  if (!env.TRADING_DEMO_ENABLED) fail('MOCK_PRICE_DISABLED', 'Mock pricing is disabled', 503);
  if (input.sellTomanPerGram > input.buyTomanPerGram)
    fail('INVALID_SPREAD', 'Sell price cannot exceed buy price', 422);
  return transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [input.purity]);
    const existing = await client.query<{ id: string; purity: string }>(
      'SELECT id,purity FROM gold_assets WHERE code=$1 FOR UPDATE',
      [input.code]
    );
    if (existing.rows[0] && existing.rows[0].purity !== input.purity)
      fail('IMMUTABLE_ASSET', 'Asset purity cannot change after creation');
    const purityOwner = await client.query(
      'SELECT id FROM gold_assets WHERE purity=$1 AND code<>$2',
      [input.purity, input.code]
    );
    if (purityOwner.rowCount) fail('PURITY_EXISTS', 'This purity already has an asset');
    const asset = await client.query<{ id: string }>(
      'INSERT INTO gold_assets(code,name,purity) VALUES($1,$2,$3) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,active=true RETURNING id',
      [input.code, input.name, input.purity]
    );
    const id = asset.rows[0]!.id;
    await client.query(
      'INSERT INTO gold_mock_prices(asset_id,buy_toman_per_gram,sell_toman_per_gram,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT(asset_id) DO UPDATE SET buy_toman_per_gram=$2,sell_toman_per_gram=$3,updated_by=$4,updated_at=now()',
      [id, input.buyTomanPerGram, input.sellTomanPerGram, actor.id]
    );
    await audit(client, actor.id, 'mock_price_set', 'gold_asset', id, requestId, {
      buyTomanPerGram: input.buyTomanPerGram,
      sellTomanPerGram: input.sellTomanPerGram,
    });
    return { id };
  });
}
export async function createPriceLock(actor: Actor, body: unknown) {
  requireCustomer(actor);
  const input = z
    .object({
      side: z.enum(['buy', 'sell']),
      assetId: uuid,
      unitId: uuid,
      quantity: quantity,
      idempotencyKey: uuid,
    })
    .strict()
    .parse(body);
  const unit = await pool.query<{ milligrams_per_unit: string }>(
    'SELECT milligrams_per_unit::text FROM gold_units WHERE id=$1',
    [input.unitId]
  );
  if (!unit.rows[0]) fail('INVALID_UNIT', 'Unit not found', 422);
  const mg = mgOf(input.quantity, BigInt(unit.rows[0].milligrams_per_unit));
  const previous = await pool.query<Lock & { unit_id: string }>(
    'SELECT * FROM platform_price_locks WHERE user_id=$1 AND idempotency_key=$2',
    [actor.id, input.idempotencyKey]
  );
  if (previous.rows[0]) {
    const current = previous.rows[0];
    if (
      current.side !== input.side ||
      current.asset_id !== input.assetId ||
      current.unit_id !== input.unitId ||
      BigInt(current.quantity_mg) !== mg
    )
      fail('DUPLICATE_REQUEST', 'Idempotency key used with different input');
    return { ...current, server_time: new Date().toISOString() };
  }
  const quote = await pricingProvider().getQuote({
    side: input.side,
    goldAssetId: input.assetId,
    quantityMg: mg,
    unitId: input.unitId,
  });
  return transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', [
      actor.id,
      input.idempotencyKey,
    ]);
    await requireTrustedTx(client, actor);
    const existing = await client.query(
      'SELECT * FROM platform_price_locks WHERE user_id=$1 AND idempotency_key=$2',
      [actor.id, input.idempotencyKey]
    );
    const current = existing.rows[0];
    if (current) {
      if (
        current.side !== input.side ||
        current.asset_id !== input.assetId ||
        current.unit_id !== input.unitId ||
        BigInt(current.quantity_mg) !== mg
      )
        fail('DUPLICATE_REQUEST', 'Idempotency key used with different input');
      return { ...current, server_time: new Date().toISOString() };
    }
    if (input.side === 'sell') {
      const a = await account(client, actor.id, 'gold', input.assetId);
      if (BigInt(a.available) < mg) fail('INSUFFICIENT_GOLD', 'Insufficient gold balance');
    }
    const rate = quote.rateTomanPerGram;
    const total = (mg * rate + (input.side === 'buy' ? 999n : 0n)) / 1000n;
    if (total <= 0n) fail('AMOUNT_TOO_SMALL', 'Trade total must be positive', 422);
    const inserted = await client.query(
      "INSERT INTO platform_price_locks(user_id,asset_id,unit_id,side,quantity_mg,rate_toman_per_gram,total_toman,source,idempotency_key,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,clock_timestamp()+$10*interval '1 second') RETURNING *",
      [
        actor.id,
        input.assetId,
        input.unitId,
        input.side,
        mg.toString(),
        rate.toString(),
        asMoney(total),
        quote.source,
        input.idempotencyKey,
        env.PRICE_LOCK_SECONDS,
      ]
    );
    return { ...inserted.rows[0], server_time: new Date().toISOString() };
  });
}
export async function createOrder(actor: Actor, body: unknown) {
  requireCustomer(actor);
  const { priceLockId } = z.object({ priceLockId: uuid }).strict().parse(body);
  return transaction(async (client) => {
    await requireTrustedTx(client, actor);
    const found = await client.query<Lock>(
      'SELECT * FROM platform_price_locks WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [priceLockId, actor.id]
    );
    const lock = found.rows[0];
    if (!lock) fail('NOT_FOUND', 'Price lock not found', 404);
    const replay = await client.query<{ id: string }>(
      'SELECT id FROM platform_orders WHERE price_lock_id=$1',
      [priceLockId]
    );
    if (replay.rows[0]) return replay.rows[0];
    if (lock.expires_at.getTime() <= Date.now()) fail('PRICE_LOCK_EXPIRED', 'Price lock expired');
    const order = await client.query<{ id: string }>(
      "INSERT INTO platform_orders(user_id,price_lock_id,state,payment_deadline) VALUES($1,$2,$3,CASE WHEN $3='pending_payment' THEN clock_timestamp()+$4*interval '1 second' ELSE NULL END) RETURNING id",
      [
        actor.id,
        priceLockId,
        lock.side === 'sell' ? 'admin_review' : 'pending_payment',
        env.PAYMENT_WINDOW_SECONDS,
      ]
    );
    const id = order.rows[0]!.id;
    if (lock.side === 'sell') {
      const a = await account(client, actor.id, 'gold', lock.asset_id);
      const mg = BigInt(lock.quantity_mg);
      if (BigInt(a.available) < mg) fail('INSUFFICIENT_GOLD', 'Insufficient gold balance');
      await movement(client, a, -mg, mg, 'sell_hold', id);
      await client.query(
        "INSERT INTO platform_reservations(account_id,order_id,amount,state) VALUES($1,$2,$3,'active')",
        [a.id, id, mg.toString()]
      );
    }
    return { id };
  });
}
export async function definePayments(actor: Actor, orderId: string, body: unknown) {
  requireCustomer(actor);
  const input = z
    .object({
      walletToman: z.number().int().min(0).safe(),
      bankToman: z.number().int().min(0).safe(),
    })
    .strict()
    .parse(body);
  return transaction(async (client) => {
    const o = await lockedOrder(client, orderId, actor.id);
    const existing = await client.query(
      'SELECT method,amount_toman::float8 AS "amountToman",id FROM platform_payments WHERE order_id=$1 ORDER BY method',
      [orderId]
    );
    if (existing.rowCount) {
      const byMethod = Object.fromEntries(existing.rows.map((p) => [p.method, p.amountToman]));
      if (
        (byMethod.wallet ?? 0) !== input.walletToman ||
        (byMethod.bank_transfer ?? 0) !== input.bankToman
      )
        fail('DUPLICATE_REQUEST', 'Payment plan already exists');
      return existing.rows;
    }
    await expireIfNeeded(client, o);
    if (o.state !== 'pending_payment' || o.side !== 'buy')
      fail('INVALID_ORDER_STATE', 'Order is not awaiting payment');
    if (BigInt(input.walletToman) + BigInt(input.bankToman) !== BigInt(o.total_toman))
      fail('PAYMENT_TOTAL_MISMATCH', 'Payment parts must equal order total', 422);
    if (input.walletToman) {
      const a = await account(client, actor.id, 'cash');
      const amount = BigInt(input.walletToman);
      if (BigInt(a.available) < amount) fail('INSUFFICIENT_BALANCE', 'Insufficient cash balance');
      await movement(client, a, -amount, amount, 'buy_hold', o.id);
      await client.query(
        "INSERT INTO platform_reservations(account_id,order_id,amount,state) VALUES($1,$2,$3,'active')",
        [a.id, o.id, amount.toString()]
      );
      await client.query(
        "INSERT INTO platform_payments(order_id,method,amount_toman,state) VALUES($1,'wallet',$2,'held')",
        [o.id, amount.toString()]
      );
    }
    if (input.bankToman)
      await client.query(
        "INSERT INTO platform_payments(order_id,method,amount_toman,state) VALUES($1,'bank_transfer',$2,'pending_receipt')",
        [o.id, input.bankToman]
      );
    if (!input.bankToman)
      await client.query(
        "UPDATE platform_orders SET state='admin_review',updated_at=now() WHERE id=$1",
        [o.id]
      );
    return (
      await client.query(
        'SELECT id,method,amount_toman::float8 AS "amountToman",state FROM platform_payments WHERE order_id=$1 ORDER BY method',
        [o.id]
      )
    ).rows;
  });
}

export async function wallets(actor: Actor) {
  const rows = await pool.query(
    `SELECT a.id,a.kind,a.asset_id AS "assetId",g.code AS "assetCode",a.available::text,a.held::text FROM platform_accounts a LEFT JOIN gold_assets g ON g.id=a.asset_id WHERE a.user_id=$1 ORDER BY a.kind,a.asset_id`,
    [actor.id]
  );
  return rows.rows;
}
export async function ledgerHistory(actor: Actor, accountId: string) {
  const own = await pool.query('SELECT 1 FROM platform_accounts WHERE id=$1 AND user_id=$2', [
    accountId,
    actor.id,
  ]);
  if (!own.rowCount) fail('NOT_FOUND', 'Wallet not found', 404);
  return (
    await pool.query(
      'SELECT id,order_id AS "orderId",withdrawal_id AS "withdrawalId",action,available_delta::text AS "availableDelta",held_delta::text AS "heldDelta",created_at AS "createdAt" FROM platform_ledger WHERE account_id=$1 ORDER BY id DESC LIMIT 100',
      [accountId]
    )
  ).rows;
}
export async function orders(actor: Actor, admin = false) {
  const rows = await pool.query(
    `SELECT o.id,o.user_id AS "userId",o.state,o.correction_deadline AS "correctionDeadline",o.rejection_reason AS "rejectionReason",o.created_at AS "createdAt",l.side,l.asset_id AS "assetId",a.code AS "assetCode",l.quantity_mg::text AS "quantityMg",l.rate_toman_per_gram::text AS "rateTomanPerGram",l.total_toman::text AS "totalToman",l.expires_at AS "expiresAt",COALESCE((SELECT json_agg(json_build_object('id',p.id,'method',p.method,'amountToman',p.amount_toman::text,'state',p.state) ORDER BY p.created_at) FROM platform_payments p WHERE p.order_id=o.id),'[]') AS payments,COALESCE((SELECT json_agg(json_build_object('id',r.id,'state',r.state,'rejectionReason',r.rejection_reason,'createdAt',r.created_at) ORDER BY r.created_at) FROM platform_receipts r JOIN platform_payments p ON p.id=r.payment_id WHERE p.order_id=o.id),'[]') AS receipts FROM platform_orders o JOIN platform_price_locks l ON l.id=o.price_lock_id JOIN gold_assets a ON a.id=l.asset_id WHERE ${admin ? 'true' : 'o.user_id=$1'} ORDER BY o.created_at DESC LIMIT 100`,
    admin ? [] : [actor.id]
  );
  return rows.rows;
}
export async function orderDetail(actor: Actor, id: string) {
  const row = await pool.query(
    `SELECT o.id,o.user_id AS "userId",o.state,o.correction_deadline AS "correctionDeadline",o.rejection_reason AS "rejectionReason",o.created_at AS "createdAt",l.side,l.asset_id AS "assetId",a.code AS "assetCode",l.quantity_mg::text AS "quantityMg",l.total_toman::text AS "totalToman",l.expires_at AS "expiresAt" FROM platform_orders o JOIN platform_price_locks l ON l.id=o.price_lock_id JOIN gold_assets a ON a.id=l.asset_id WHERE o.id=$1 AND ($2 OR o.user_id=$3)`,
    [id, actor.role === 'admin', actor.id]
  );
  if (!row.rows[0]) fail('NOT_FOUND', 'Order not found', 404);
  const payments = await pool.query(
    'SELECT id,method,amount_toman::text AS "amountToman",state FROM platform_payments WHERE order_id=$1',
    [id]
  );
  const receipts = await pool.query(
    'SELECT r.id,r.payment_id AS "paymentId",r.state,r.rejection_reason AS "rejectionReason",r.created_at AS "createdAt" FROM platform_receipts r JOIN platform_payments p ON p.id=r.payment_id WHERE p.order_id=$1 ORDER BY r.created_at',
    [id]
  );
  return {
    ...row.rows[0],
    payments: payments.rows,
    receipts: receipts.rows,
    paymentInstructions: env.PAYMENT_INSTRUCTIONS,
  };
}

export async function submitReceipt(actor: Actor, paymentId: string, buffer: Buffer) {
  const mime = receiptType(buffer);
  const digest = createHash('sha256').update(buffer).digest('hex');
  const key = randomUUID();
  const directory = resolve(env.RECEIPT_DIRECTORY);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(resolve(directory, key), buffer, { flag: 'wx', mode: 0o600 });
  try {
    const result = await transaction(async (client) => {
      const related = await client.query<{ order_id: string }>(
        'SELECT order_id FROM platform_payments WHERE id=$1',
        [paymentId]
      );
      if (!related.rows[0]) fail('NOT_FOUND', 'Payment not found', 404);
      const o = await lockedOrder(client, related.rows[0].order_id, actor.id);
      await expireIfNeeded(client, o);
      const payment = await client.query<{ state: string; method: string }>(
        'SELECT state,method FROM platform_payments WHERE id=$1 FOR UPDATE',
        [paymentId]
      );
      const previous = await client.query<{ id: string }>(
        'SELECT id FROM platform_receipts WHERE payment_id=$1 AND digest=$2',
        [paymentId, digest]
      );
      if (previous.rows[0] && o.state === 'payment_review' && payment.rows[0]?.state === 'review')
        return { id: previous.rows[0].id, replay: true };
      if (previous.rows[0]) fail('DUPLICATE_RECEIPT', 'A new receipt image is required');
      if (
        payment.rows[0]?.method !== 'bank_transfer' ||
        !['pending_receipt', 'rejected'].includes(payment.rows[0].state) ||
        !['pending_payment', 'correction_window'].includes(o.state)
      )
        fail('INVALID_ORDER_STATE', 'Receipt cannot be submitted now');
      if (
        o.state === 'correction_window' &&
        (!o.correction_deadline || o.correction_deadline.getTime() <= Date.now())
      )
        fail('RECEIPT_WINDOW_EXPIRED', 'Correction window expired');
      const inserted = await client.query<{ id: string }>(
        "INSERT INTO platform_receipts(payment_id,storage_key,mime,digest,state) VALUES($1,$2,$3,$4,'review') RETURNING id",
        [paymentId, key, mime, digest]
      );
      await client.query("UPDATE platform_payments SET state='review' WHERE id=$1", [paymentId]);
      await client.query(
        "UPDATE platform_orders SET state='payment_review',correction_deadline=NULL,updated_at=now() WHERE id=$1",
        [o.id]
      );
      return { id: inserted.rows[0]!.id, replay: false };
    });
    if (result.replay) await unlink(resolve(directory, key));
    return { id: result.id };
  } catch (error) {
    await unlink(resolve(directory, key)).catch(() => undefined);
    throw error;
  }
}
export async function receiptAccess(actor: Actor, receiptId: string) {
  const row = await pool.query<{ storage_key: string; mime: string }>(
    `SELECT r.storage_key,r.mime FROM platform_receipts r JOIN platform_payments p ON p.id=r.payment_id JOIN platform_orders o ON o.id=p.order_id WHERE r.id=$1 AND ($2 OR o.user_id=$3)`,
    [receiptId, actor.role === 'admin', actor.id]
  );
  if (!row.rows[0]) fail('NOT_FOUND', 'Receipt not found', 404);
  return { path: resolve(env.RECEIPT_DIRECTORY, row.rows[0].storage_key), mime: row.rows[0].mime };
}
export async function reviewPayment(
  actor: Actor,
  paymentId: string,
  body: unknown,
  requestId?: string
) {
  const input = z
    .discriminatedUnion('decision', [
      z.object({ decision: z.literal('approve') }).strict(),
      z
        .object({ decision: z.literal('reject'), reason: z.string().trim().min(3).max(1000) })
        .strict(),
    ])
    .parse(body);
  return transaction(async (client) => {
    const related = await client.query<{ order_id: string }>(
      'SELECT order_id FROM platform_payments WHERE id=$1',
      [paymentId]
    );
    if (!related.rows[0]) fail('NOT_FOUND', 'Payment not found', 404);
    const o = await lockedOrder(client, related.rows[0].order_id);
    await expireIfNeeded(client, o);
    const payment = await client.query<{ state: string; method: string }>(
      'SELECT state,method FROM platform_payments WHERE id=$1 FOR UPDATE',
      [paymentId]
    );
    if (payment.rows[0]?.method !== 'bank_transfer')
      fail('INVALID_PAYMENT', 'Bank transfer required');
    if (payment.rows[0].state === 'approved' && input.decision === 'approve')
      return { id: paymentId, state: 'approved' };
    if (payment.rows[0].state === 'rejected' && input.decision === 'reject') {
      const previous = await client.query<{ rejection_reason: string }>(
        "SELECT rejection_reason FROM platform_receipts WHERE payment_id=$1 AND state='rejected' ORDER BY reviewed_at DESC LIMIT 1",
        [paymentId]
      );
      if (previous.rows[0]?.rejection_reason !== input.reason)
        fail('DUPLICATE_REQUEST', 'Decision replay differs from the original');
      return { id: paymentId, state: 'rejected' };
    }
    if (o.state !== 'payment_review' || payment.rows[0].state !== 'review')
      fail('INVALID_ORDER_STATE', 'Payment is not in review');
    const receipt = await client.query<{ id: string }>(
      "SELECT id FROM platform_receipts WHERE payment_id=$1 AND state='review' ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
      [paymentId]
    );
    if (!receipt.rows[0]) fail('INVALID_PAYMENT', 'A receipt is required');
    if (input.decision === 'approve') {
      await client.query(
        "UPDATE platform_receipts SET state='approved',reviewed_by=$2,reviewed_at=now() WHERE id=$1",
        [receipt.rows[0].id, actor.id]
      );
      await client.query("UPDATE platform_payments SET state='approved' WHERE id=$1", [paymentId]);
      await client.query(
        "UPDATE platform_orders SET state='admin_review',updated_at=now() WHERE id=$1",
        [o.id]
      );
    } else {
      await client.query(
        "UPDATE platform_receipts SET state='rejected',reviewed_by=$2,reviewed_at=now(),rejection_reason=$3 WHERE id=$1",
        [receipt.rows[0].id, actor.id, input.reason]
      );
      await client.query("UPDATE platform_payments SET state='rejected' WHERE id=$1", [paymentId]);
      await client.query(
        "UPDATE platform_orders SET state='correction_window',correction_deadline=clock_timestamp()+$2*interval '1 second',updated_at=now() WHERE id=$1",
        [o.id, env.RECEIPT_CORRECTION_SECONDS]
      );
    }
    await audit(
      client,
      actor.id,
      `payment_${input.decision}`,
      'payment',
      paymentId,
      requestId,
      input.decision === 'reject' ? { reason: input.reason } : {}
    );
    return { id: paymentId, state: input.decision === 'approve' ? 'approved' : 'rejected' };
  });
}
export async function decideOrder(
  actor: Actor,
  orderId: string,
  body: unknown,
  requestId?: string
) {
  const input = z
    .discriminatedUnion('decision', [
      z.object({ decision: z.literal('approve') }).strict(),
      z
        .object({ decision: z.literal('reject'), reason: z.string().trim().min(3).max(1000) })
        .strict(),
    ])
    .parse(body);
  try {
    return await transaction(async (client) => {
      const o = await lockedOrder(client, orderId);
      await expireIfNeeded(client, o);
      if (o.state === 'completed' && input.decision === 'approve')
        return { id: orderId, state: 'completed' };
      if (o.state === 'rejected' && input.decision === 'reject') {
        if (o.rejection_reason !== input.reason)
          fail('DUPLICATE_REQUEST', 'Decision replay differs from the original');
        return { id: orderId, state: 'rejected' };
      }
      if (input.decision === 'reject') {
        if (
          !['admin_review', 'payment_review', 'correction_window', 'pending_payment'].includes(
            o.state
          )
        )
          fail('INVALID_ORDER_STATE', 'Order cannot be rejected');
        await release(client, o, 'rejected');
        await client.query('UPDATE platform_orders SET rejection_reason=$2 WHERE id=$1', [
          orderId,
          input.reason,
        ]);
        await audit(client, actor.id, 'order_reject', 'order', orderId, requestId, {
          reason: input.reason,
        });
        return { id: orderId, state: 'rejected' };
      }
      if (o.state !== 'admin_review')
        fail('INVALID_ORDER_STATE', 'Order is not ready for approval');
      if (o.side === 'buy') {
        const payments = await client.query<{
          method: string;
          amount_toman: string;
          state: string;
        }>(
          'SELECT method,amount_toman::text,state FROM platform_payments WHERE order_id=$1 FOR UPDATE',
          [orderId]
        );
        const sum = payments.rows.reduce((total, p) => total + BigInt(p.amount_toman), 0n);
        if (
          !payments.rowCount ||
          sum !== BigInt(o.total_toman) ||
          payments.rows.some((p) =>
            p.method === 'bank_transfer' ? p.state !== 'approved' : p.state !== 'held'
          )
        )
          fail('PAYMENT_TOTAL_MISMATCH', 'Payment is incomplete');
        const reservation = await client.query<{ id: string; amount: string }>(
          "SELECT id,amount::text FROM platform_reservations WHERE order_id=$1 AND state='active' FOR UPDATE",
          [orderId]
        );
        if (reservation.rows[0]) {
          const cash = await account(client, o.user_id, 'cash');
          await movement(
            client,
            cash,
            0n,
            -BigInt(reservation.rows[0].amount),
            'buy_settle',
            orderId
          );
          await client.query("UPDATE platform_reservations SET state='consumed' WHERE id=$1", [
            reservation.rows[0].id,
          ]);
        }
        const gold = await account(client, o.user_id, 'gold', o.asset_id);
        await movement(client, gold, BigInt(o.quantity_mg), 0n, 'buy_credit', orderId);
      } else {
        const reservation = await client.query<{ id: string; amount: string }>(
          "SELECT id,amount::text FROM platform_reservations WHERE order_id=$1 AND state='active' FOR UPDATE",
          [orderId]
        );
        if (!reservation.rows[0]) fail('INVALID_ORDER_STATE', 'Gold hold is missing');
        const cash = await account(client, o.user_id, 'cash');
        const gold = await account(client, o.user_id, 'gold', o.asset_id);
        await movement(
          client,
          gold,
          0n,
          -BigInt(reservation.rows[0].amount),
          'sell_settle',
          orderId
        );
        await client.query("UPDATE platform_reservations SET state='consumed' WHERE id=$1", [
          reservation.rows[0].id,
        ]);
        await movement(client, cash, BigInt(o.total_toman), 0n, 'sell_credit', orderId);
      }
      await client.query(
        "UPDATE platform_payments SET state='settled' WHERE order_id=$1 AND state IN ('held','approved')",
        [orderId]
      );
      await client.query(
        "UPDATE platform_orders SET state='completed',updated_at=now() WHERE id=$1",
        [orderId]
      );
      await audit(client, actor.id, 'order_approve', 'order', orderId, requestId);
      return { id: orderId, state: 'completed' };
    });
  } catch (error) {
    if (input.decision === 'approve') {
      const code = error instanceof AppError ? error.code : 'INTERNAL_ERROR';
      await pool
        .query(
          'INSERT INTO platform_audit(actor_id,action,entity_type,entity_id,request_id,details) VALUES($1,$2,$3,$4,$5,$6)',
          [
            actor.id,
            'order_approval_failed',
            'order',
            orderId,
            requestId ?? null,
            JSON.stringify({ code }),
          ]
        )
        .catch(() => undefined);
    }
    throw error;
  }
}
export async function addBankAccount(actor: Actor, body: unknown) {
  const input = z
    .object({ iban: z.string().regex(/^IR\d{24}$/), holderName: z.string().trim().min(2).max(100) })
    .strict()
    .parse(body);
  const hash = createHmac('sha256', bankKey).update(input.iban).digest('hex');
  return transaction(async (client) => {
    const row = await client.query(
      'INSERT INTO platform_bank_accounts(user_id,iban_cipher,iban_hash,iban_last_four,holder_name) VALUES($1,pgp_sym_encrypt($2,$3,\'cipher-algo=aes256\'),$4,$5,$6) ON CONFLICT(user_id,iban_hash) DO UPDATE SET holder_name=$6 RETURNING id,pgp_sym_decrypt(iban_cipher,$3) AS iban,holder_name AS "holderName"',
      [actor.id, input.iban, bankKey, hash, input.iban.slice(-4), input.holderName]
    );
    await audit(client, actor.id, 'bank_account_upsert', 'bank_account', row.rows[0].id);
    return row.rows[0];
  });
}
export async function bankAccounts(actor: Actor) {
  return (
    await pool.query(
      'SELECT id,pgp_sym_decrypt(iban_cipher,$2) AS iban,holder_name AS "holderName" FROM platform_bank_accounts WHERE user_id=$1 ORDER BY created_at DESC',
      [actor.id, bankKey]
    )
  ).rows;
}
export async function createWithdrawal(actor: Actor, body: unknown) {
  requireCustomer(actor);
  const input = z
    .object({ bankAccountId: uuid, amountToman: money, idempotencyKey: uuid })
    .strict()
    .parse(body);
  return transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', [
      actor.id,
      input.idempotencyKey,
    ]);
    await requireTrustedTx(client, actor);
    const replay = await client.query<{
      id: string;
      amount_toman: string;
      bank_account_id: string;
    }>(
      'SELECT id,amount_toman::text,bank_account_id FROM platform_withdrawals WHERE user_id=$1 AND idempotency_key=$2',
      [actor.id, input.idempotencyKey]
    );
    if (replay.rows[0]) {
      if (
        BigInt(replay.rows[0].amount_toman) !== BigInt(input.amountToman) ||
        replay.rows[0].bank_account_id !== input.bankAccountId
      )
        fail('DUPLICATE_REQUEST', 'Idempotency key used with different input');
      return { id: replay.rows[0].id };
    }
    const bank = await client.query(
      'SELECT 1 FROM platform_bank_accounts WHERE id=$1 AND user_id=$2',
      [input.bankAccountId, actor.id]
    );
    if (!bank.rowCount) fail('NOT_FOUND', 'Bank account not found', 404);
    const cash = await account(client, actor.id, 'cash');
    const amount = BigInt(input.amountToman);
    if (BigInt(cash.available) < amount) fail('INSUFFICIENT_BALANCE', 'Insufficient cash balance');
    const created = await client.query<{ id: string }>(
      "INSERT INTO platform_withdrawals(user_id,bank_account_id,amount_toman,state,idempotency_key) VALUES($1,$2,$3,'pending',$4) RETURNING id",
      [actor.id, input.bankAccountId, input.amountToman, input.idempotencyKey]
    );
    const id = created.rows[0]!.id;
    await movement(client, cash, -amount, amount, 'withdrawal_hold', undefined, id);
    await client.query(
      "INSERT INTO platform_reservations(account_id,withdrawal_id,amount,state) VALUES($1,$2,$3,'active')",
      [cash.id, id, amount.toString()]
    );
    return { id };
  });
}
export async function withdrawals(actor: Actor, admin = false) {
  return (
    await pool.query(
      `SELECT w.id,w.user_id AS "userId",w.amount_toman::text AS "amountToman",w.state,w.rejection_reason AS "rejectionReason",w.created_at AS "createdAt",b.iban_last_four AS "ibanLastFour",${admin ? 'pgp_sym_decrypt(b.iban_cipher,$1) AS iban,' : ''}b.holder_name AS "holderName" FROM platform_withdrawals w JOIN platform_bank_accounts b ON b.id=w.bank_account_id WHERE ${admin ? 'true' : 'w.user_id=$1'} ORDER BY w.created_at DESC LIMIT 100`,
      admin ? [bankKey] : [actor.id]
    )
  ).rows;
}
export async function decideWithdrawal(
  actor: Actor,
  id: string,
  body: unknown,
  requestId?: string
) {
  const input = z
    .discriminatedUnion('decision', [
      z
        .object({
          decision: z.literal('approve'),
          payoutReference: z.string().trim().min(3).max(200),
        })
        .strict(),
      z
        .object({ decision: z.literal('reject'), reason: z.string().trim().min(3).max(1000) })
        .strict(),
    ])
    .parse(body);
  return transaction(async (client) => {
    const found = await client.query<{
      user_id: string;
      amount_toman: string;
      state: string;
      rejection_reason: string | null;
      payout_reference: string | null;
    }>(
      'SELECT user_id,amount_toman::text,state,rejection_reason,payout_reference FROM platform_withdrawals WHERE id=$1 FOR UPDATE',
      [id]
    );
    if (!found.rows[0]) fail('NOT_FOUND', 'Withdrawal not found', 404);
    const withdrawal = found.rows[0];
    const state = input.decision === 'approve' ? 'approved' : 'rejected';
    if (withdrawal.state === state) {
      if (
        input.decision === 'reject'
          ? withdrawal.rejection_reason !== input.reason
          : withdrawal.payout_reference !== input.payoutReference
      )
        fail('DUPLICATE_REQUEST', 'Decision replay differs from the original');
      return { id, state };
    }
    if (withdrawal.state !== 'pending') fail('INVALID_ORDER_STATE', 'Withdrawal already decided');
    const hold = await client.query<{ id: string; amount: string }>(
      "SELECT id,amount::text FROM platform_reservations WHERE withdrawal_id=$1 AND state='active' FOR UPDATE",
      [id]
    );
    if (!hold.rows[0]) fail('INVALID_ORDER_STATE', 'Withdrawal hold missing');
    const cash = await account(client, withdrawal.user_id, 'cash');
    const amount = BigInt(hold.rows[0].amount);
    await movement(
      client,
      cash,
      input.decision === 'reject' ? amount : 0n,
      -amount,
      `withdrawal_${state}`,
      undefined,
      id
    );
    await client.query('UPDATE platform_reservations SET state=$2 WHERE id=$1', [
      hold.rows[0].id,
      input.decision === 'approve' ? 'consumed' : 'released',
    ]);
    await client.query(
      'UPDATE platform_withdrawals SET state=$2,reviewer_id=$3,rejection_reason=$4,payout_reference=$5,updated_at=now() WHERE id=$1',
      [
        id,
        state,
        actor.id,
        input.decision === 'reject' ? input.reason : null,
        input.decision === 'approve' ? input.payoutReference : null,
      ]
    );
    await audit(
      client,
      actor.id,
      `withdrawal_${state}`,
      'withdrawal',
      id,
      requestId,
      input.decision === 'reject'
        ? { reason: input.reason }
        : { payoutReference: input.payoutReference }
    );
    return { id, state };
  });
}
