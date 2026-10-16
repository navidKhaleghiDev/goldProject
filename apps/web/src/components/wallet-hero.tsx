'use client';

import { useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Coins, Gem, Wallet } from 'lucide-react';
import Link from 'next/link';
import type { Wallet as WalletBalance } from '@/lib/platform';

const tabs = [
  { label: 'کیف پول', icon: Wallet },
  { label: 'طلای آب‌شده', icon: Gem },
  { label: 'سکه طلا', icon: Coins },
] as const;

const grams = (milligrams: bigint) =>
  (Number(milligrams) / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 3 });

export function WalletHero({
  wallets,
  isPending,
  isError,
  retry,
}: {
  wallets: WalletBalance[] | undefined;
  isPending: boolean;
  isError: boolean;
  retry: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const cash = wallets?.find((wallet) => wallet.kind === 'cash');
  const gold = wallets?.filter((wallet) => wallet.kind === 'gold') ?? [];
  const goldAvailable = gold.reduce((sum, wallet) => sum + BigInt(wallet.available), 0n);
  const goldHeld = gold.reduce((sum, wallet) => sum + BigInt(wallet.held), 0n);
  const activeTab = tabs[selected] ?? tabs[0];

  const selectPrevious = () => setSelected((current) => (current + tabs.length - 1) % tabs.length);
  const selectNext = () => setSelected((current) => (current + 1) % tabs.length);

  return (
    <section className="wallet-hero" aria-label="خلاصه دارایی‌های من">
      <div className="wallet-hero-tabs" role="group" aria-label="نوع دارایی">
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.label}
              type="button"
              aria-pressed={selected === index}
              className="wallet-hero-tab"
              onClick={() => setSelected(index)}
            >
              <Icon size={15} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="wallet-hero-stage">
        <button
          type="button"
          className="wallet-hero-arrow"
          aria-label="دارایی قبلی"
          onClick={selectPrevious}
        >
          <ChevronRight size={25} aria-hidden="true" />
        </button>
        <div className="wallet-hero-panel" aria-live="polite" key={selected}>
          <p className="wallet-hero-kicker">موجودی قابل استفاده {activeTab.label}</p>
          {selected === 2 ? (
            <>
              <strong className="wallet-hero-amount">در دسترس نیست</strong>
              <p className="wallet-hero-caption">موجودی سکه هنوز به حساب متصل نشده است</p>
            </>
          ) : isPending ? (
            <p className="wallet-hero-message" role="status">
              در حال دریافت موجودی…
            </p>
          ) : isError ? (
            <div className="wallet-hero-message" role="alert">
              <span>موجودی دریافت نشد</span>
              <button type="button" className="wallet-hero-retry" onClick={retry}>
                تلاش دوباره
              </button>
            </div>
          ) : selected === 0 ? (
            <>
              <strong className="wallet-hero-amount" dir="rtl">
                {(cash ? BigInt(cash.available) : 0n).toLocaleString('fa-IR')}
                <span className="wallet-hero-unit">تومان</span>
              </strong>
              <p className="wallet-hero-caption">
                {cash && BigInt(cash.held) > 0n
                  ? `${BigInt(cash.held).toLocaleString('fa-IR')} تومان مسدود`
                  : 'وجه نقد آماده استفاده'}
              </p>
            </>
          ) : (
            <>
              <strong className="wallet-hero-amount" dir="rtl">
                {grams(goldAvailable)} <span className="wallet-hero-unit">گرم</span>
              </strong>
              <p className="wallet-hero-caption">
                {goldHeld > 0n ? `${grams(goldHeld)} گرم مسدود` : 'طلای قابل فروش در کیف پول'}
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          className="wallet-hero-arrow"
          aria-label="دارایی بعدی"
          onClick={selectNext}
        >
          <ChevronLeft size={25} aria-hidden="true" />
        </button>
      </div>

      {selected === 2 ? (
        <span className="wallet-hero-details wallet-hero-details-muted">
          جزئیات پس از فعال‌سازی
        </span>
      ) : (
        <Link href="/trade/buy#wallets" className="wallet-hero-details">
          جزئیات <ArrowLeft size={15} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
