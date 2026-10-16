'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GoldTransaction } from '@sheri-gold/contracts';
import { api } from '@/lib/api';
import { date, grams, statuses, trading } from '@/lib/trading';
import { formatToman } from '@/lib/utils';
import { Button } from './ui/button';
import { Failure, field, panel, SessionGate, TradingShell } from './trading-shell';
import { useToast } from './toast-provider';
export function GoldHistory() {
  return (
    <TradingShell title="تاریخچه معاملات">
      <SessionGate>{() => <TransactionList />}</SessionGate>
    </TradingShell>
  );
}
export function TransactionList() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['gold', 'transactions', page],
    queryFn: ({ signal }) => trading.transactions(page, signal),
    refetchInterval: 10000,
  });
  return (
    <>
      {query.isPending ? (
        <p role="status">در حال دریافت معاملات…</p>
      ) : query.error ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data.length ? (
            <p className={panel}>
              معامله‌ای در این صفحه وجود ندارد.{' '}
              <Link href="/trade/buy" className="text-[var(--teal-700)]">
                شروع خرید
              </Link>
            </p>
          ) : (
            query.data.map((t) => (
              <Link key={t.id} href={`/requests/${t.id}`} className={`${panel} block space-y-3`}>
                <div className="flex justify-between gap-3">
                  <strong>
                    {t.kind === 'buy' ? 'خرید' : 'فروش'} {grams(t.weightMg)} گرم
                  </strong>
                  <span className="rounded-full bg-[var(--teal-50)] px-2 py-1 text-xs text-[var(--teal-700)]">
                    {statuses[t.status]}
                  </span>
                </div>
                <p className="text-sm">{formatToman(t.totalToman)}</p>
                <p className="text-xs text-[var(--muted)]">
                  {t.customerName} · {date(t.createdAt)}
                </p>
                {t.rejectionReason && (
                  <p className="text-sm text-[var(--danger)]">{t.rejectionReason}</p>
                )}
              </Link>
            ))
          )}
          <div className="flex items-center justify-between">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              قبلی
            </Button>
            <span className="text-xs">صفحه {page.toLocaleString('fa-IR')}</span>
            <Button
              variant="outline"
              disabled={query.data.length < 30}
              onClick={() => setPage((p) => p + 1)}
            >
              بعدی
            </Button>
          </div>
        </>
      )}
    </>
  );
}
export function GoldTransactionDetail({ id }: { id: string }) {
  return (
    <TradingShell title="جزئیات معامله">
      <SessionGate>{(user) => <Detail id={id} admin={user.role === 'admin'} />}</SessionGate>
    </TradingShell>
  );
}
function Detail({ id, admin }: { id: string; admin: boolean }) {
  const query = useQuery({
    queryKey: ['gold', 'transaction', id],
    queryFn: ({ signal }) => trading.transaction(id, signal),
    refetchInterval: 5000,
  });
  if (query.isPending) return <p role="status">در حال دریافت معامله…</p>;
  if (query.error) return <Failure error={query.error} retry={() => void query.refetch()} />;
  const t = query.data;
  return (
    <>
      <section className={`${panel} space-y-3`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t.kind === 'buy' ? 'خرید' : 'فروش'} {grams(t.weightMg)} گرم
          </h2>
          <span className="rounded-full bg-[var(--teal-50)] p-2 text-xs">{statuses[t.status]}</span>
        </div>
        <p className="text-2xl font-semibold text-[var(--teal-700)]">{formatToman(t.totalToman)}</p>
        <p className="text-xs text-[var(--muted)]">
          عیار {t.purity} · {date(t.createdAt)}
        </p>
        <p className="break-all text-xs text-[var(--muted)]">شناسه: {t.id}</p>
        {t.isDemo && (
          <p className="text-sm text-[var(--danger)]">معامله آزمایشی؛ وجه واقعی واریز نکنید.</p>
        )}
        {t.rejectionReason && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-[var(--danger)]">
            دلیل رد: {t.rejectionReason}
            {t.kind === 'sell'
              ? ' — طلای مسدود آزاد شد.'
              : ' — برای پیگیری وجه پرداخت‌شده با طلافروش هماهنگ کنید.'}
          </p>
        )}
        {t.settlementAcknowledgement && (
          <p className="text-sm">تأییدیه تسویه: {t.settlementAcknowledgement}</p>
        )}
        {t.latePayment && (
          <p className="text-sm text-[var(--danger)]">
            رسید پس از پایان مهلت قیمت ارسال شده و نیاز به تطبیق پرداخت دارد.
          </p>
        )}
      </section>
      {t.status === 'awaiting_payment' && (
        <section className={`${panel} space-y-3`}>
          <h2 className="font-semibold">پرداخت خارج از سامانه</h2>
          <p className="whitespace-pre-wrap text-sm leading-7">{t.paymentInstructions}</p>
          <PaymentTimer expiresAt={t.expiresAt} serverTime={t.serverTime} />
          <p className="text-xs leading-7 text-[var(--muted)]">
            پس از پایان مهلت، پرداخت جدید انجام ندهید. اگر قبلاً پرداخت کرده‌اید، رسید را برای بررسی
            دستی ارسال کنید. ارسال رسید به معنی تأیید خرید نیست.
          </p>
          {!admin && <ReceiptForm transaction={t} />}
        </section>
      )}
      {t.hasReceipt && (
        <a
          href={`${api.defaults.baseURL}/trading/transactions/${t.id}/receipt`}
          target="_blank"
          rel="noreferrer"
          className={`${panel} block text-center text-[var(--teal-700)]`}
        >
          مشاهده رسید پرداخت ↗
        </a>
      )}
      {admin && ['payment_submitted', 'admin_review'].includes(t.status) && (
        <ReviewForm transaction={t} />
      )}
      {t.status === 'completed' && (
        <p role="status" className={panel}>
          {t.kind === 'buy'
            ? 'خرید تأیید شد و طلا به موجودی شما اضافه شد.'
            : 'تسویه ثبت شد و طلا از موجودی مسدود کسر شد.'}
        </p>
      )}
      {!admin && ['payment_submitted', 'admin_review'].includes(t.status) && (
        <p role="status" className={panel}>
          درخواست شما در انتظار بررسی طلافروش است. نتیجه در همین صفحه نمایش داده می‌شود.
        </p>
      )}
      <section className={panel}>
        <h2 className="font-semibold">روند معامله</h2>
        <ol className="mt-4 space-y-4 border-r border-[var(--border)] pr-4">
          {t.history.map((event, index) => (
            <li key={`${event.createdAt}-${index}`}>
              <p className="text-sm font-semibold">{statuses[event.status] ?? event.status}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{date(event.createdAt)}</p>
              {event.note && <p className="mt-1 break-words text-sm">{event.note}</p>}
            </li>
          ))}
        </ol>
      </section>
      <Link href="/requests" className="block p-2 text-center text-sm text-[var(--teal-700)]">
        بازگشت به تاریخچه
      </Link>
    </>
  );
}
function PaymentTimer({ expiresAt, serverTime }: { expiresAt: string; serverTime: string }) {
  const [seconds, setSeconds] = useState(
    Math.max(0, Math.floor((Date.parse(expiresAt) - Date.parse(serverTime)) / 1000))
  );
  useEffect(() => {
    const deadline =
      performance.now() + Math.max(0, Date.parse(expiresAt) - Date.parse(serverTime));
    const timer = setInterval(
      () => setSeconds(Math.max(0, Math.floor((deadline - performance.now()) / 1000))),
      250
    );
    return () => clearInterval(timer);
  }, [expiresAt, serverTime]);
  return (
    <p className={seconds ? 'text-sm' : 'text-sm text-[var(--danger)]'}>
      {seconds
        ? `زمان باقی‌مانده قیمت: ${seconds.toLocaleString('fa-IR')} ثانیه`
        : 'مهلت قیمت پایان یافته است؛ پرداخت جدید انجام ندهید.'}
    </p>
  );
}
function ReceiptForm({ transaction: t }: { transaction: GoldTransaction }) {
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState('');
  const cache = useQueryClient();
  const { show } = useToast();
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Missing file');
      await trading.receipt(t.id, file);
    },
    onSuccess: () => {
      show({ message: 'رسید برای بررسی ارسال شد.', tone: 'success' });
      return cache.invalidateQueries({ queryKey: ['gold'] });
    },
  });
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (file) upload.mutate();
      }}
    >
      <label className="block text-sm" htmlFor="receipt">
        تصویر رسید (JPEG یا PNG، حداکثر ۵ مگابایت)
      </label>
      <input
        id="receipt"
        type="file"
        accept="image/png,image/jpeg"
        required
        className={`${field} text-sm`}
        onChange={(event) => {
          const chosen = event.target.files?.[0] ?? null;
          const valid =
            chosen &&
            ['image/png', 'image/jpeg'].includes(chosen.type) &&
            chosen.size <= 5 * 1024 * 1024;
          setFile(valid ? chosen : null);
          setValidation(chosen && !valid ? 'نوع یا اندازه فایل مجاز نیست.' : '');
        }}
      />
      {validation && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {validation}
        </p>
      )}
      {upload.error && <Failure error={upload.error} />}
      <Button className="w-full" disabled={!file || upload.isPending}>
        {upload.isPending ? 'در حال ارسال…' : 'ارسال رسید برای بررسی'}
      </Button>
    </form>
  );
}
function ReviewForm({ transaction: t }: { transaction: GoldTransaction }) {
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const cache = useQueryClient();
  const { show } = useToast();
  const mutation = useMutation({
    mutationFn: async () => {
      if (t.status === 'payment_submitted') {
        await trading.review(t.id);
        return;
      }
      await trading.decide(
        t.id,
        decision === 'reject'
          ? { decision, reason: note }
          : { decision, ...(note ? { acknowledgement: note } : {}) }
      );
    },
    onSuccess: () => {
      show({ message: 'نتیجه بررسی ثبت شد.', tone: 'success' });
      return cache.invalidateQueries({ queryKey: ['gold'] });
    },
  });
  return (
    <form
      className={`${panel} space-y-4`}
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <h2 className="font-semibold">بررسی مدیر</h2>
      {t.status === 'payment_submitted' ? (
        <p className="text-sm">ابتدا رسید را باز کنید و بررسی را شروع کنید.</p>
      ) : (
        <>
          <label className="block text-sm">
            نتیجه بررسی
            <select
              className={`${field} mt-2`}
              value={decision}
              onChange={(e) => {
                setDecision(e.target.value as 'approve' | 'reject');
                setConfirmed(false);
              }}
            >
              <option value="approve">تأیید معامله</option>
              <option value="reject">رد معامله</option>
            </select>
          </label>
          <label className="block text-sm">
            {decision === 'reject'
              ? 'دلیل رد (الزامی)'
              : t.kind === 'sell'
                ? 'تأییدیه پرداخت خارج از سامانه (الزامی)'
                : 'یادداشت بررسی پرداخت'}
            <textarea
              className={`${field} mt-2`}
              maxLength={1000}
              minLength={3}
              required={decision === 'reject' || t.kind === 'sell'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <label className="flex items-start gap-2 text-sm leading-6">
            <input
              className="mt-1 size-5"
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {decision === 'reject'
              ? 'دلیل رد و اثر آن بر موجودی را بررسی کردم.'
              : t.kind === 'sell'
                ? 'پرداخت به مشتری خارج از سامانه انجام شده است.'
                : 'دریافت وجه و تطبیق مبلغ و رسید را تأیید می‌کنم.'}
          </label>
        </>
      )}
      {mutation.error && <Failure error={mutation.error} />}
      <Button className="w-full" disabled={mutation.isPending}>
        {mutation.isPending
          ? 'در حال ثبت…'
          : t.status === 'payment_submitted'
            ? 'شروع بررسی رسید'
            : 'ثبت نتیجه نهایی'}
      </Button>
    </form>
  );
}
