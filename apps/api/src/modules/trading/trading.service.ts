import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { pool } from '../../database/pool.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/app-error.js';
import type { Actor } from '../auth/auth.js';
import { getRates } from './trading.rates.js';
import {
  decisionSchema,
  milligrams,
  quoteSchema,
  receiptType,
  totalToman,
} from './trading.rules.js';
import { event, ledger, transaction } from './trading.repository.js';

interface Quote {
  id: string;
  user_id: string;
  kind: 'buy' | 'sell';
  weight_mg: number;
  rate_toman: string;
  total_toman: string;
  purity: string;
  is_demo: boolean;
  payment_instructions: string;
  expires_at: Date;
}
interface Trade {
  id: string;
  user_id: string;
  status: string;
  receipt_digest: string | null;
  rejection_reason: string | null;
  settlement_acknowledgement: string | null;
  kind: 'buy' | 'sell';
  weight_mg: number;
  expires_at: Date;
}
function quoteDto(q: Quote) {
  return {
    id: q.id,
    kind: q.kind,
    weightMg: q.weight_mg,
    rateToman: Number(q.rate_toman),
    totalToman: Number(q.total_toman),
    purity: q.purity,
    isDemo: q.is_demo,
    expiresAt: q.expires_at,
    serverTime: new Date().toISOString(),
  };
}
async function requireTrusted(client: import('pg').PoolClient, actor: Actor) {
  const mode = `${env.TRADING_DEMO_ENABLED ? 'demo' : 'live'}:${env.GOLD_PURITY}`;
  await client.query(
    "INSERT INTO app_settings(key,value) VALUES('gold_accounting_mode',$1) ON CONFLICT(key) DO NOTHING",
    [mode]
  );
  const setting = await client.query(
    "SELECT value FROM app_settings WHERE key='gold_accounting_mode'",
    []
  );
  if (setting.rows[0]?.value !== mode)
    throw new AppError(
      503,
      'ACCOUNTING_MODE_MISMATCH',
      'نوع حسابداری یا عیار با موجودی ثبت‌شده سازگار نیست.'
    );
  const user = await client.query('SELECT trusted,role FROM users WHERE id=$1 FOR SHARE', [
    actor.id,
  ]);
  if (!user.rows[0]?.trusted || user.rows[0]?.role !== 'customer')
    throw new AppError(403, 'TRUST_REQUIRED', 'معامله پس از تأیید حساب توسط طلافروش فعال می‌شود.');
}
export async function createQuote(actor: Actor, body: unknown) {
  if (actor.role !== 'customer' || !actor.trusted)
    throw new AppError(403, 'TRUST_REQUIRED', 'معامله پس از تأیید حساب توسط طلافروش فعال می‌شود.');
  const input = quoteSchema.parse(body);
  const mg = milligrams(input.weightGrams);
  if (mg < env.MIN_TRADE_MG || mg > env.MAX_TRADE_MG)
    throw new AppError(422, 'WEIGHT_LIMIT', 'وزن خارج از محدوده مجاز است.');
  const existing = await pool.query<Quote>(
    'SELECT * FROM gold_quotes WHERE user_id=$1 AND idempotency_key=$2',
    [actor.id, input.idempotencyKey]
  );
  if (existing.rows[0]) {
    const q = existing.rows[0];
    if (q.kind !== input.kind || q.weight_mg !== mg)
      throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'کلید درخواست قبلاً استفاده شده است.');
    return quoteDto(q);
  }
  const rates = await getRates();
  if (!env.TRADING_DEMO_ENABLED && !env.PAYMENT_INSTRUCTIONS)
    throw new AppError(503, 'PAYMENT_NOT_CONFIGURED', 'اطلاعات پرداخت هنوز تنظیم نشده است.');
  return transaction(async (client) => {
    await requireTrusted(client, actor);
    const rate = input.kind === 'buy' ? rates.buyTomanPerGram : rates.sellTomanPerGram;
    const inserted = await client.query<Quote>(
      `INSERT INTO gold_quotes(user_id,kind,weight_mg,rate_toman,total_toman,purity,is_demo,payment_instructions,expires_at,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp()+$9*interval '1 second',$10) ON CONFLICT(user_id,idempotency_key) DO NOTHING RETURNING *`,
      [
        actor.id,
        input.kind,
        mg,
        rate,
        totalToman(mg, rate),
        rates.purity,
        rates.isDemo,
        env.PAYMENT_INSTRUCTIONS || 'حالت آزمایشی؛ وجه واقعی واریز نکنید.',
        env.PRICE_LOCK_SECONDS,
        input.idempotencyKey,
      ]
    );
    const q =
      inserted.rows[0] ??
      (
        await client.query<Quote>(
          'SELECT * FROM gold_quotes WHERE user_id=$1 AND idempotency_key=$2',
          [actor.id, input.idempotencyKey]
        )
      ).rows[0]!;
    if (q.kind !== input.kind || q.weight_mg !== mg)
      throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'کلید درخواست قبلاً استفاده شده است.');
    return quoteDto(q);
  });
}
export async function acceptQuote(actor: Actor, quoteId: string) {
  return transaction(async (client) => {
    const result = await client.query<Quote>(
      'SELECT * FROM gold_quotes WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [quoteId, actor.id]
    );
    const q = result.rows[0];
    if (!q) throw new AppError(404, 'NOT_FOUND', 'قیمت پیدا نشد.');
    const replay = await client.query<{ id: string }>(
      'SELECT id FROM gold_transactions WHERE quote_id=$1',
      [q.id]
    );
    if (replay.rows[0]) return replay.rows[0];
    await requireTrusted(client, actor);
    const valid = await client.query(
      'SELECT 1 FROM gold_quotes WHERE id=$1 AND expires_at>clock_timestamp()',
      [q.id]
    );
    if (!valid.rowCount)
      throw new AppError(409, 'QUOTE_EXPIRED', 'مهلت قیمت پایان یافته؛ قیمت جدید بگیرید.');
    await client.query('INSERT INTO gold_wallets(user_id) VALUES($1) ON CONFLICT DO NOTHING', [
      actor.id,
    ]);
    if (q.kind === 'sell') {
      const moved = await client.query(
        'UPDATE gold_wallets SET available_mg=available_mg-$2,frozen_mg=frozen_mg+$2 WHERE user_id=$1 AND available_mg>=$2',
        [actor.id, q.weight_mg]
      );
      if (!moved.rowCount)
        throw new AppError(409, 'INSUFFICIENT_GOLD', 'موجودی قابل فروش کافی نیست.');
    }
    const status = q.kind === 'buy' ? 'awaiting_payment' : 'admin_review';
    const inserted = await client.query<{ id: string }>(
      'INSERT INTO gold_transactions(quote_id,user_id,status) VALUES($1,$2,$3) RETURNING id',
      [q.id, actor.id, status]
    );
    const trade = inserted.rows[0]!;
    await event(client, trade.id, actor.id, 'price_locked');
    if (q.kind === 'sell') {
      await ledger(client, trade.id, actor.id, 'freeze', -q.weight_mg, q.weight_mg);
      await event(client, trade.id, actor.id, 'gold_frozen');
    }
    await event(client, trade.id, actor.id, status);
    return trade;
  });
}
export async function uploadReceipt(actor: Actor, id: string, buffer: Buffer) {
  const mime = receiptType(buffer);
  const digest = createHash('sha256').update(buffer).digest('hex');
  const key = randomUUID();
  let written = false;
  try {
    return await transaction(async (client) => {
      const result = await client.query<Trade>(
        `SELECT t.*,q.kind,q.expires_at FROM gold_transactions t JOIN gold_quotes q ON q.id=t.quote_id WHERE t.id=$1 AND t.user_id=$2 FOR UPDATE OF t`,
        [id, actor.id]
      );
      const t = result.rows[0];
      if (!t) throw new AppError(404, 'NOT_FOUND', 'معامله پیدا نشد.');
      if (t.receipt_digest === digest) return { id };
      if (t.kind !== 'buy' || t.status !== 'awaiting_payment')
        throw new AppError(409, 'INVALID_STATE', 'در این وضعیت امکان ارسال رسید نیست.');
      await mkdir(resolve(env.RECEIPT_DIRECTORY), { recursive: true });
      await writeFile(resolve(env.RECEIPT_DIRECTORY, key), buffer, { flag: 'wx' });
      written = true;
      await client.query(
        `UPDATE gold_transactions SET receipt_key=$2,receipt_mime=$3,receipt_digest=$4,late_payment=($5::timestamptz<clock_timestamp()),status='payment_submitted',updated_at=now() WHERE id=$1`,
        [id, key, mime, digest, t.expires_at]
      );
      await event(client, id, actor.id, 'payment_submitted');
      return { id };
    });
  } catch (error) {
    if (written) await unlink(resolve(env.RECEIPT_DIRECTORY, key)).catch(() => undefined);
    throw error;
  }
}
export async function beginReview(actor: Actor, id: string) {
  return transaction(async (client) => {
    const updated = await client.query(
      `UPDATE gold_transactions SET status='admin_review',updated_at=now() WHERE id=$1 AND status='payment_submitted' RETURNING id`,
      [id]
    );
    if (updated.rowCount) await event(client, id, actor.id, 'admin_review');
    else {
      const state = await client.query('SELECT status FROM gold_transactions WHERE id=$1', [id]);
      if (state.rows[0]?.status !== 'admin_review')
        throw new AppError(409, 'INVALID_STATE', 'معامله آماده بررسی نیست.');
    }
    return { id };
  });
}
export async function decide(actor: Actor, id: string, body: unknown) {
  const input = decisionSchema.parse(body);
  return transaction(async (client) => {
    const result = await client.query<Trade>(
      `SELECT t.*,q.kind,q.weight_mg FROM gold_transactions t JOIN gold_quotes q ON q.id=t.quote_id WHERE t.id=$1 FOR UPDATE OF t`,
      [id]
    );
    const t = result.rows[0];
    if (!t) throw new AppError(404, 'NOT_FOUND', 'معامله پیدا نشد.');
    const status = input.decision === 'approve' ? 'completed' : 'rejected';
    const note = input.decision === 'reject' ? input.reason : (input.acknowledgement ?? null);
    if (
      t.status === status &&
      (status === 'rejected' ? t.rejection_reason : t.settlement_acknowledgement) === note
    )
      return { id };
    if (t.status !== 'admin_review')
      throw new AppError(409, 'INVALID_STATE', 'معامله باید در حال بررسی باشد.');
    if (input.decision === 'approve' && t.kind === 'sell' && !input.acknowledgement)
      throw new AppError(422, 'SETTLEMENT_REQUIRED', 'تأییدیه تسویه خارج از سامانه الزامی است.');
    if (input.decision === 'approve' && t.kind === 'buy' && !t.receipt_digest)
      throw new AppError(409, 'RECEIPT_REQUIRED', 'رسید پرداخت لازم است.');
    const available =
      t.kind === 'buy'
        ? status === 'completed'
          ? t.weight_mg
          : 0
        : status === 'rejected'
          ? t.weight_mg
          : 0;
    const frozen = t.kind === 'sell' ? -t.weight_mg : 0;
    const wallet = await client.query(
      'UPDATE gold_wallets SET available_mg=available_mg+$2,frozen_mg=frozen_mg+$3 WHERE user_id=$1 AND frozen_mg+$3>=0',
      [t.user_id, available, frozen]
    );
    if (!wallet.rowCount) throw new AppError(409, 'BALANCE_CONFLICT', 'موجودی نیاز به بررسی دارد.');
    await ledger(client, id, t.user_id, status, available, frozen);
    await client.query(
      'UPDATE gold_transactions SET status=$2,rejection_reason=$3,settlement_acknowledgement=$4,updated_at=now() WHERE id=$1',
      [id, status, status === 'rejected' ? note : null, status === 'completed' ? note : null]
    );
    await event(client, id, actor.id, status, note);
    return { id };
  });
}
export const uuid = z.string().uuid();
