import type { PoolClient } from 'pg';
import { pool } from '../../database/pool.js';
export async function transaction<T>(run: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
export async function event(
  client: PoolClient,
  id: string,
  actor: string,
  status: string,
  note: string | null = null
) {
  await client.query(
    'INSERT INTO gold_events(transaction_id,actor_id,status,note) VALUES($1,$2,$3,$4)',
    [id, actor, status, note]
  );
}
export async function ledger(
  client: PoolClient,
  id: string,
  user: string,
  action: string,
  available: number,
  frozen: number
) {
  await client.query(
    'INSERT INTO gold_ledger(transaction_id,user_id,action,available_delta_mg,frozen_delta_mg) VALUES($1,$2,$3,$4,$5)',
    [id, user, action, available, frozen]
  );
}
export const tradeSelect = `SELECT t.id,t.user_id AS "userId",u.full_name AS "customerName",t.status,q.kind,q.weight_mg AS "weightMg",q.rate_toman::float8 AS "rateToman",q.total_toman::float8 AS "totalToman",q.purity,q.is_demo AS "isDemo",q.payment_instructions AS "paymentInstructions",q.expires_at AS "expiresAt",t.created_at AS "createdAt",t.late_payment AS "latePayment",t.rejection_reason AS "rejectionReason",t.settlement_acknowledgement AS "settlementAcknowledgement",(t.receipt_key IS NOT NULL) AS "hasReceipt",
clock_timestamp() AS "serverTime", COALESCE((SELECT json_agg(json_build_object('status',e.status,'note',e.note,'createdAt',e.created_at) ORDER BY e.id) FROM gold_events e WHERE e.transaction_id=t.id),'[]') AS history
FROM gold_transactions t JOIN gold_quotes q ON q.id=t.quote_id JOIN users u ON u.id=t.user_id`;
