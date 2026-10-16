'use client';
import type {
  ApiSuccess,
  GoldQuote,
  GoldRates,
  GoldTransaction,
  GoldWallet,
  SessionUser,
} from '@sheri-gold/contracts';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { api } from './api';
async function get<T>(path: string, signal?: AbortSignal) {
  return (await api.get<ApiSuccess<T>>(path, signal ? { signal } : {})).data.data;
}
async function post<T>(path: string, body: unknown) {
  return (await api.post<ApiSuccess<T>>(path, body)).data.data;
}
export const trading = {
  me: (signal?: AbortSignal) => get<SessionUser>('/auth/me', signal),
  requestOtp: (phone: string) =>
    post<{ requested: boolean; expiresInSeconds: number }>('/auth/otp/request', { phone }),
  verifyOtp: (input: { phone: string; code: string; fullName?: string }) =>
    post<SessionUser>('/auth/otp/verify', input),
  logout: () => post('/auth/logout', {}),
  rates: (signal?: AbortSignal) => get<GoldRates>('/trading/rates', signal),
  wallet: (signal?: AbortSignal) => get<GoldWallet>('/trading/wallet', signal),
  quote: (input: { kind: 'buy' | 'sell'; weightGrams: string; idempotencyKey: string }) =>
    post<GoldQuote>('/trading/quotes', input),
  accept: (quoteId: string) => post<{ id: string }>('/trading/transactions', { quoteId }),
  transactions: (page: number, signal?: AbortSignal) =>
    get<GoldTransaction[]>(`/trading/transactions?page=${page}`, signal),
  transaction: (id: string, signal?: AbortSignal) =>
    get<GoldTransaction>(`/trading/transactions/${id}`, signal),
  receipt: async (id: string, file: File) => {
    await api.post(`/trading/transactions/${id}/receipt`, file, {
      headers: { 'Content-Type': file.type },
      timeout: 60000,
    });
  },
  review: (id: string) => post(`/trading/transactions/${id}/review`, {}),
  decide: (
    id: string,
    input:
      { decision: 'reject'; reason: string } | { decision: 'approve'; acknowledgement?: string }
  ) => post(`/trading/transactions/${id}/decision`, input),
  customers: (page: number, signal?: AbortSignal) =>
    get<SessionUser[]>(`/trading/customers?page=${page}`, signal),
  trust: async (id: string, trusted: boolean) => {
    await api.patch(`/trading/customers/${id}`, { trusted });
  },
};
export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: ({ signal }) => trading.me(signal),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
export function errorMessage(error: unknown) {
  const messages: Record<string, string> = {
    TRUST_REQUIRED: 'معامله پس از تأیید حساب توسط طلافروش فعال می‌شود.',
    UNAUTHENTICATED: 'برای ادامه وارد حساب شوید.',
    INVALID_OTP: 'کد تأیید نادرست یا منقضی شده است.',
    OTP_COOLDOWN: 'برای درخواست دوباره کد کمی صبر کنید.',
    NAME_REQUIRED: 'برای ایجاد حساب، نام و نام خانوادگی را وارد کنید.',
    SMS_UNAVAILABLE: 'ارسال پیامک هنوز راه‌اندازی نشده است.',
    PRICE_UNAVAILABLE: 'قیمت معتبر در دسترس نیست. بعداً دوباره تلاش کنید.',
    PRICE_LOCK_EXPIRED: 'مهلت قیمت پایان یافت؛ قیمت جدید بگیرید.',
    INSUFFICIENT_BALANCE: 'موجودی نقدی کافی نیست.',
    INSUFFICIENT_GOLD: 'موجودی طلای این عیار کافی نیست.',
    PAYMENT_TOTAL_MISMATCH: 'مجموع روش‌های پرداخت باید با مبلغ سفارش برابر باشد.',
    INVALID_ORDER_STATE: 'این اقدام در وضعیت فعلی سفارش امکان‌پذیر نیست.',
    RECEIPT_WINDOW_EXPIRED: 'مهلت ارسال دوباره رسید پایان یافته است.',
    DUPLICATE_RECEIPT: 'برای اصلاح، تصویر رسید جدیدی انتخاب کنید.',
    DUPLICATE_REQUEST: 'این درخواست قبلاً با اطلاعات متفاوت ثبت شده است.',
    NOT_FOUND: 'مورد درخواستی پیدا نشد.',
    VALIDATION_ERROR: 'اطلاعات واردشده معتبر نیست.',
    INVALID_RECEIPT: 'رسید باید تصویر PNG یا JPEG معتبر و حداکثر ۵ مگابایت باشد.',
  };
  if (axios.isAxiosError(error)) {
    const code: unknown = error.response?.data?.error?.code;
    if (typeof code === 'string' && messages[code]) return messages[code];
    return 'ارتباط با سرور برقرار نشد یا درخواست انجام نشد. دوباره تلاش کنید.';
  }
  return 'خطایی رخ داد. دوباره تلاش کنید.';
}
export function isGuest(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401;
}
export const grams = (mg: number) =>
  (mg / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 3 });
export const date = (value: string) =>
  new Date(value).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
export const statuses: Record<string, string> = {
  awaiting_payment: 'در انتظار پرداخت',
  payment_submitted: 'رسید ارسال شد',
  admin_review: 'در حال بررسی',
  completed: 'تکمیل‌شده',
  rejected: 'ردشده',
  price_locked: 'قیمت قفل شد',
  gold_frozen: 'طلا مسدود شد',
};
