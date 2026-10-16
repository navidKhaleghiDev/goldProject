'use client';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, LockKeyhole, Wallet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { date, grams, trading } from '@/lib/trading';
import { formatToman } from '@/lib/utils';
import { Failure, panel, SessionGate, TradingShell } from './trading-shell';
export function GoldDashboard() {
  return (
    <TradingShell title="طلای من">
      <SessionGate>
        {(user) => (
          <>
            <section className="rounded-2xl bg-[var(--teal-950)] p-6 text-white">
              <p className="text-sm text-white/65">سلام، {user.fullName}</p>
              <h2 className="mt-3 text-xl font-semibold">خرید، نگهداری و فروش طلا</h2>
              <p className="mt-2 text-sm leading-7 text-white/75">
                پرداخت و تسویه با طلافروش انجام می‌شود. موجودی پس از تأیید نهایی به‌روز می‌شود.
              </p>
            </section>
            {user.role === 'admin' ? (
              <Link className={`${panel} block text-[var(--teal-700)]`} href="/admin">
                ورود به مدیریت مشتریان و معاملات ←
              </Link>
            ) : !user.trusted ? (
              <p role="status" className={`${panel} text-sm leading-7`}>
                حساب شما در انتظار تأیید طلافروش است. تا زمان تأیید، ثبت معامله فعال نیست.
              </p>
            ) : null}
            <WalletCard />
            <RatesCard />
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/trade/buy"
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--teal-700)] p-4 font-semibold text-white"
              >
                <ArrowDownLeft size={20} />
                خرید طلا
              </Link>
              <Link
                href="/trade/sell"
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--teal-700)] p-4 font-semibold text-[var(--teal-700)]"
              >
                <ArrowUpRight size={20} />
                فروش طلا
              </Link>
            </div>
            <Link href="/requests" className={`${panel} block`}>
              تاریخچه و پیگیری معاملات ←
            </Link>
          </>
        )}
      </SessionGate>
    </TradingShell>
  );
}
export function WalletCard() {
  const query = useQuery({
    queryKey: ['gold', 'wallet'],
    queryFn: ({ signal }) => trading.wallet(signal),
    refetchInterval: 10000,
  });
  if (query.error) return <Failure error={query.error} retry={() => void query.refetch()} />;
  return (
    <section className={panel}>
      <h2 className="flex items-center gap-2 font-semibold">
        <Wallet size={18} /> موجودی طلا
      </h2>
      {query.data ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-[var(--muted)]">قابل فروش</p>
              <strong className="mt-1 block text-2xl text-[var(--teal-700)]">
                {grams(query.data.availableMg)} <small className="text-xs">گرم</small>
              </strong>
            </div>
            <div className="border-r border-[var(--border)] pr-4">
              <p className="flex items-center gap-1 text-xs text-[var(--muted)]">
                <LockKeyhole size={13} />
                مسدود در فروش
              </p>
              <strong className="mt-1 block text-2xl">
                {grams(query.data.frozenMg)} <small className="text-xs">گرم</small>
              </strong>
            </div>
          </div>
          <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
            طلای مسدود تا پایان بررسی فروش قابل معامله نیست. در صورت رد، آزاد می‌شود.
          </p>
        </>
      ) : (
        <p role="status" className="mt-3">
          در حال دریافت موجودی…
        </p>
      )}
    </section>
  );
}
export function RatesCard() {
  const query = useQuery({
    queryKey: ['gold', 'rates'],
    queryFn: ({ signal }) => trading.rates(signal),
    refetchInterval: 10000,
    retry: false,
  });
  if (query.error) return <Failure error={query.error} retry={() => void query.refetch()} />;
  return (
    <section className={panel}>
      <h2 className="font-semibold">قیمت هر گرم طلا</h2>
      {query.data ? (
        <>
          <p className="mt-1 text-xs text-[var(--muted)]">
            عیار: {query.data.purity} ·{' '}
            {query.data.isDemo ? 'قیمت آزمایشی — معامله واقعی نیست' : 'دریافت‌شده از منبع قیمت'}
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-2">
              <dt>خرید شما</dt>
              <dd className="font-semibold">{formatToman(query.data.buyTomanPerGram)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>فروش شما</dt>
              <dd className="font-semibold">{formatToman(query.data.sellTomanPerGram)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-[var(--muted)]">
            آخرین دریافت: {date(query.data.updatedAt)}
          </p>
        </>
      ) : (
        <p role="status">در حال دریافت قیمت…</p>
      )}
    </section>
  );
}
