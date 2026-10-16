'use client';
import type { ApiSuccess } from '@sheri-gold/contracts';
import { api } from './api';

export type Asset = {
  id: string;
  code: string;
  name: string;
  purity: string;
  buyTomanPerGram: number | null;
  sellTomanPerGram: number | null;
};
export type Unit = { id: string; code: string; name: string; milligramsPerUnit: string };
export type Wallet = {
  id: string;
  kind: 'cash' | 'gold';
  assetId: string | null;
  assetCode: string | null;
  available: string;
  held: string;
};
export type Payment = {
  id: string;
  method: 'wallet' | 'bank_transfer';
  amountToman: string;
  state: string;
};
export type Order = {
  id: string;
  createdAt: string;
  userId: string;
  state: string;
  side: 'buy' | 'sell';
  assetId: string;
  assetCode: string;
  quantityMg: string;
  totalToman: string;
  expiresAt: string;
  correctionDeadline: string | null;
  rejectionReason: string | null;
  payments?: Payment[];
  receipts?: { id: string; state: string; rejectionReason: string | null; createdAt: string }[];
  paymentInstructions?: string;
};
export type Withdrawal = {
  id: string;
  amountToman: string;
  state: string;
  ibanLastFour: string;
  iban?: string;
  holderName: string;
  rejectionReason: string | null;
};
export type BankAccount = { id: string; iban: string; holderName: string };
export type LedgerEntry = {
  id: number;
  action: string;
  availableDelta: string;
  heldDelta: string;
  createdAt: string;
};
export type PriceLock = {
  id: string;
  side: 'buy' | 'sell';
  quantity_mg: string;
  total_toman: string;
  rate_toman_per_gram: string;
  expires_at: string;
  server_time: string;
};
const get = async <T>(path: string, signal?: AbortSignal): Promise<T> =>
  (await api.get<ApiSuccess<T>>(`/platform${path}`, signal ? { signal } : {})).data.data;
const post = async <T>(path: string, body: unknown): Promise<T> =>
  (await api.post<ApiSuccess<T>>(`/platform${path}`, body)).data.data;
export const platform = {
  assets: (signal?: AbortSignal) =>
    get<{ assets: Asset[]; units: Unit[]; isDemo: boolean }>('/gold-assets', signal),
  wallets: (signal?: AbortSignal) => get<Wallet[]>('/wallets', signal),
  ledger: (id: string, signal?: AbortSignal) =>
    get<LedgerEntry[]>(`/wallets/${id}/transactions`, signal),
  orders: (signal?: AbortSignal) => get<Order[]>('/orders', signal),
  order: (id: string, signal?: AbortSignal) => get<Order>(`/orders/${id}`, signal),
  withdrawals: (signal?: AbortSignal) => get<Withdrawal[]>('/withdrawals', signal),
  bankAccounts: (signal?: AbortSignal) => get<BankAccount[]>('/bank-accounts', signal),
  priceLock: (input: {
    side: 'buy' | 'sell';
    assetId: string;
    unitId: string;
    quantity: string;
    idempotencyKey: string;
  }) => post<PriceLock>('/price-locks', input),
  createOrder: (priceLockId: string) => post<{ id: string }>('/orders', { priceLockId }),
  payments: (id: string, walletToman: number, bankToman: number) =>
    post<Payment[]>(`/orders/${id}/payments`, { walletToman, bankToman }),
  receipt: async (id: string, file: File) => {
    await api.post(`/platform/payments/${id}/receipts`, file, {
      headers: { 'Content-Type': file.type },
      timeout: 60000,
    });
  },
  addBank: (iban: string, holderName: string) =>
    post<BankAccount>('/bank-accounts', { iban, holderName }),
  withdraw: (bankAccountId: string, amountToman: number, idempotencyKey: string) =>
    post<{ id: string }>('/withdrawals', { bankAccountId, amountToman, idempotencyKey }),
  adminOrders: (signal?: AbortSignal) => get<Order[]>('/admin/orders', signal),
  adminWithdrawals: (signal?: AbortSignal) => get<Withdrawal[]>('/admin/withdrawals', signal),
  setAsset: (input: {
    code: string;
    name: string;
    purity: string;
    buyTomanPerGram: number;
    sellTomanPerGram: number;
  }) => post<{ id: string }>('/admin/gold-assets', input),
  decideOrder: (id: string, decision: 'approve' | 'reject', reason?: string) =>
    post(`/admin/orders/${id}/${decision}`, reason ? { reason } : {}),
  decidePayment: (id: string, decision: 'approve' | 'reject', reason?: string) =>
    post(`/admin/payments/${id}/${decision}`, reason ? { reason } : {}),
  decideWithdrawal: (
    id: string,
    decision: 'approve' | 'reject',
    reason?: string,
    payoutReference?: string
  ) =>
    post(
      `/admin/withdrawals/${id}/${decision}`,
      decision === 'approve' ? { payoutReference } : { reason }
    ),
};
