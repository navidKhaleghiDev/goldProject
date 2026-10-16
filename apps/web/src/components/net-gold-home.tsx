'use client';

import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { platform } from '@/lib/platform';
import { MobileShell } from './mobile-shell';
import { Failure, SessionGate } from './trading-shell';
import { WalletHero } from './wallet-hero';

const money = (value: string | number | bigint) => BigInt(value).toLocaleString('fa-IR');
const weight = (milligrams: bigint) =>
  (Number(milligrams) / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 3 });
const status: Record<string, string> = {
  pending_payment: 'در انتظار پرداخت',
  payment_review: 'بررسی رسید',
  correction_window: 'مهلت اصلاح رسید',
  admin_review: 'در انتظار بررسی',
  completed: 'تکمیل‌شده',
  expired: 'منقضی‌شده',
  rejected: 'ردشده',
};

export function NetGoldHome() {
  return (
    <MobileShell protectedPage>
      <main className="net-page space-y-0 px-5 pb-28">
        <SessionGate>
          {(user) =>
            user.role === 'admin' ? (
              <div className="py-10">
                <p className="text-[var(--muted)]">به پنل مدیریت خوش آمدید.</p>
                <Link
                  href="/admin"
                  className="mt-5 inline-block border-b border-[var(--accent)] pb-1"
                >
                  ورود به مدیریت
                </Link>
              </div>
            ) : (
              <CustomerHome trusted={user.trusted} />
            )
          }
        </SessionGate>
      </main>
    </MobileShell>
  );
}

function CustomerHome({ trusted }: { trusted: boolean }) {
  const catalog = useQuery({
    queryKey: ['platform', 'assets'],
    queryFn: ({ signal }) => platform.assets(signal),
    refetchInterval: 15000,
  });
  const wallets = useQuery({
    queryKey: ['platform', 'wallets'],
    queryFn: ({ signal }) => platform.wallets(signal),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
  const orders = useQuery({
    queryKey: ['platform', 'orders'],
    queryFn: ({ signal }) => platform.orders(signal),
  });
  const priced = catalog.data?.assets.find((asset) => asset.buyTomanPerGram !== null);
  const goldWallets = wallets.data?.filter((wallet) => wallet.kind === 'gold') ?? [];
  const cashWallet = wallets.data?.find((wallet) => wallet.kind === 'cash');
  const holdings = goldWallets
    .map((wallet) => ({
      wallet,
      asset: catalog.data?.assets.find((item) => item.id === wallet.assetId),
      milligrams: BigInt(wallet.available),
    }))
    .filter((item) => item.milligrams > 0n);
  const totalGoldMg = holdings.reduce((total, item) => total + item.milligrams, 0n);
  const holdingsByPurity = Array.from(
    holdings.reduce((groups, item) => {
      const purity = item.asset?.purity ?? 'نامشخص';
      groups.set(purity, (groups.get(purity) ?? 0n) + item.milligrams);
      return groups;
    }, new Map<string, bigint>())
  );
  const knownValue = goldWallets.reduce((total, wallet) => {
    const asset = catalog.data?.assets.find((item) => item.id === wallet.assetId);
    return asset?.sellTomanPerGram == null
      ? total
      : total + (BigInt(wallet.available) * BigInt(asset.sellTomanPerGram)) / 1000n;
  }, 0n);
  const hasUnpricedHolding = goldWallets.some(
    (wallet) =>
      BigInt(wallet.available) > 0n &&
      catalog.data?.assets.find((item) => item.id === wallet.assetId)?.sellTomanPerGram == null
  );
  return (
    <>
      <WalletHero
        wallets={wallets.data}
        isPending={wallets.isPending}
        isError={Boolean(wallets.error)}
        retry={() => void wallets.refetch()}
      />
      <section className="border-b border-[var(--border)] pb-8 pt-9" aria-labelledby="price-title">
        <div className="flex items-center justify-between gap-3">
          <h1 id="price-title" className="text-sm font-medium text-[var(--muted)]">
            نرخ خرید هر گرم طلا
          </h1>
          <span className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <span className="size-[6px] rounded-full bg-[var(--accent)]" aria-hidden="true" />
            {catalog.dataUpdatedAt
              ? `دریافت: ${new Date(catalog.dataUpdatedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`
              : 'در حال دریافت نرخ'}
          </span>
        </div>
        {catalog.isPending ? (
          <div
            className="mt-5 h-12 w-52 animate-pulse bg-[var(--border)]"
            role="status"
            aria-label="در حال دریافت نرخ"
          />
        ) : catalog.error ? (
          <div className="mt-5">
            <Failure error={catalog.error} retry={() => void catalog.refetch()} />
          </div>
        ) : priced && priced.buyTomanPerGram !== null ? (
          <>
            <p
              className="mt-4 text-[clamp(2rem,9vw,2.5rem)] font-semibold leading-tight tabular-nums tracking-tight text-[var(--foreground)]"
              dir="ltr"
            >
              {money(priced.buyTomanPerGram)}{' '}
              <span className="text-base font-normal text-[var(--muted)]">تومان</span>
            </p>
            <p className="mt-3 text-xs text-[var(--muted)]">
              {priced.name} · عیار {priced.purity} · نرخ دریافتی از سامانه
            </p>
            {catalog.data?.isDemo && (
              <p className="mt-3 text-xs text-[var(--danger)]">
                نرخ آزمایشی است؛ وجه واقعی واریز نکنید.
              </p>
            )}
          </>
        ) : (
          <p className="mt-5 text-sm text-[var(--muted)]">هنوز نرخی برای نمایش ثبت نشده است.</p>
        )}
      </section>

      <section
        className="border-b border-[var(--border)] py-8"
        aria-labelledby="market-trend-title"
      >
        <h2 id="market-trend-title" className="text-base font-semibold">
          روند قیمت طلا
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          تاریخچه قیمت هنوز از سامانه دریافت نمی‌شود. نمودار پس از اتصال داده‌های تاریخی نمایش داده
          خواهد شد.
        </p>
      </section>

      <section className="border-b border-[var(--border)] py-8" aria-labelledby="cash-title">
        <h2 id="cash-title" className="text-base font-semibold">
          کیف پول نقدی
        </h2>
        {wallets.isPending ? (
          <p className="mt-4 text-sm text-[var(--muted)]" role="status">
            در حال دریافت موجودی…
          </p>
        ) : wallets.error ? (
          <div className="mt-4">
            <Failure error={wallets.error} retry={() => void wallets.refetch()} />
          </div>
        ) : cashWallet ? (
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs text-[var(--muted)]">قابل استفاده</p>
              <strong className="mt-1 block text-2xl tabular-nums">
                {money(cashWallet.available)} <span className="text-sm font-normal">تومان</span>
              </strong>
            </div>
            <p className="text-xs text-[var(--muted)]">مسدود: {money(cashWallet.held)} تومان</p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted)]">کیف پول نقدی هنوز در دسترس نیست.</p>
        )}
      </section>

      <section className="border-b border-[var(--border)] py-8" aria-labelledby="holding-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="holding-title" className="text-base font-semibold">
            دارایی طلای من
          </h2>
          <Link href="/account" className="text-xs text-[var(--muted)]">
            جزئیات حساب <ArrowLeft className="inline-block" size={13} aria-hidden="true" />
          </Link>
        </div>
        {wallets.isPending ? (
          <p className="mt-5 text-sm text-[var(--muted)]" role="status">
            در حال دریافت موجودی…
          </p>
        ) : wallets.error ? (
          <div className="mt-5">
            <Failure error={wallets.error} retry={() => void wallets.refetch()} />
          </div>
        ) : (
          <>
            {goldWallets.length ? (
              <ul className="mt-5 space-y-2">
                {goldWallets.map((wallet) => (
                  <li
                    key={wallet.id}
                    className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm"
                  >
                    <span>
                      {catalog.data?.assets.find((asset) => asset.id === wallet.assetId)?.name ??
                        wallet.assetCode}{' '}
                      · عیار{' '}
                      {catalog.data?.assets.find((asset) => asset.id === wallet.assetId)?.purity ??
                        'نامشخص'}
                    </span>
                    <span>
                      {weight(BigInt(wallet.available))} گرم قابل استفاده ·{' '}
                      {weight(BigInt(wallet.held))} گرم مسدود
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 text-sm text-[var(--muted)]">
                هنوز طلایی در کیف پول شما ثبت نشده است.
              </p>
            )}
            <p className="mt-2 text-sm text-[var(--muted)]">
              {hasUnpricedHolding
                ? 'ارزش تقریبی برای همه عیارها در دسترس نیست'
                : goldWallets.length
                  ? `ارزش تقریبی فروش: ${money(knownValue)} تومان`
                  : 'هنوز طلایی در کیف پول شما ثبت نشده است'}
            </p>
            {totalGoldMg > 0n && (
              <div className="mt-6" aria-label="توزیع موجودی طلا بر اساس عیار">
                <h3 className="text-sm font-medium">توزیع طلا بر اساس عیار</h3>
                <ul className="mt-3 space-y-3">
                  {holdingsByPurity.map(([purity, milligrams]) => {
                    const percent = Number((milligrams * 1000n) / totalGoldMg) / 10;
                    return (
                      <li key={purity}>
                        <div className="mb-1 flex justify-between gap-2 text-xs">
                          <span>عیار {purity}</span>
                          <span>
                            {percent.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪ ·{' '}
                            {weight(milligrams)} گرم
                          </span>
                        </div>
                        <div className="h-2 bg-[var(--teal-100)]" aria-hidden="true">
                          <div
                            className="h-full bg-[var(--accent)]"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
        {!trusted && (
          <p className="mt-4 border-r-2 border-[var(--accent)] pr-3 text-xs leading-6 text-[var(--muted)]">
            معامله پس از تأیید حساب شما فعال می‌شود.
          </p>
        )}
      </section>

      <section className="border-b border-[var(--border)] py-8" aria-labelledby="trade-title">
        <h2 id="trade-title" className="text-base font-semibold">
          معامله طلا
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">مقدار و عیار دلخواه را انتخاب کنید.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link
            href="/trade/buy"
            className="flex min-h-13 items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-3 text-sm font-medium text-[var(--ivory)]"
          >
            <ArrowDownLeft size={18} aria-hidden="true" />
            خرید طلا
          </Link>
          <Link
            href="/trade/sell"
            className="flex min-h-13 items-center justify-center gap-2 rounded-md border border-[var(--foreground)] px-3 text-sm font-medium"
          >
            <ArrowUpRight size={18} aria-hidden="true" />
            فروش طلا
          </Link>
        </div>
      </section>

      <section className="py-8" aria-labelledby="activity-title">
        <div className="flex items-center justify-between">
          <h2 id="activity-title" className="text-base font-semibold">
            فعالیت اخیر
          </h2>
          <Link href="/activity" className="text-xs text-[var(--muted)]">
            مشاهده همه <ArrowLeft className="inline-block" size={13} aria-hidden="true" />
          </Link>
        </div>
        {orders.isPending ? (
          <p className="mt-5 text-sm text-[var(--muted)]" role="status">
            در حال دریافت فعالیت…
          </p>
        ) : orders.error ? (
          <div className="mt-5">
            <Failure error={orders.error} retry={() => void orders.refetch()} />
          </div>
        ) : !orders.data?.length ? (
          <p className="mt-5 text-sm text-[var(--muted)]">هنوز معامله‌ای ثبت نشده است.</p>
        ) : (
          <ul className="mt-4">
            {orders.data.slice(0, 4).map((order) => (
              <li key={order.id} className="border-b border-[var(--border)] py-4 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {order.side === 'buy' ? 'خرید' : 'فروش'} {weight(BigInt(order.quantityMg))}{' '}
                      گرم · {order.assetCode}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {new Date(order.createdAt).toLocaleString('fa-IR')} ·{' '}
                      {status[order.state] ?? order.state}
                    </p>
                  </div>
                  <span className="text-sm tabular-nums">
                    {money(order.totalToman)}{' '}
                    <span className="text-xs text-[var(--muted)]">تومان</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
