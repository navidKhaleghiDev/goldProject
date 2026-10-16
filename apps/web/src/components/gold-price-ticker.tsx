'use client';

import { useQuery } from '@tanstack/react-query';
import { platform } from '@/lib/platform';
import { ToastNotice } from './toast-provider';

export function GoldPriceTicker() {
  const query = useQuery({
    queryKey: ['platform', 'assets'],
    queryFn: ({ signal }) => platform.assets(signal),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
  const asset = query.data?.assets.find((item) => item.buyTomanPerGram !== null);
  return (
    <div className="gold-price-strip" aria-live="polite">
      <span className="gold-price-strip-label">
        <span className="gold-price-strip-dot" aria-hidden="true" />
        {asset ? `هر گرم ${asset.name} · عیار ${asset.purity}` : 'قیمت هر گرم طلا'}
      </span>
      {query.isPending ? (
        <div
          role="status"
          aria-label="در حال دریافت قیمت"
          className="h-4 w-24 animate-pulse rounded bg-white/30"
        />
      ) : query.error ? (
        <>
          <ToastNotice
            message="دریافت قیمت طلا انجام نشد. دوباره تلاش کنید."
            tone="error"
            action={{ label: 'تلاش دوباره', onClick: () => void query.refetch() }}
          />
          <button
            className="text-xs font-semibold text-white underline"
            onClick={() => void query.refetch()}
          >
            قیمت در دسترس نیست · تلاش دوباره
          </button>
        </>
      ) : asset?.buyTomanPerGram != null ? (
        <strong className="gold-price-strip-value">
          {asset.buyTomanPerGram.toLocaleString('fa-IR')} <span className="font-normal">تومان</span>
          {query.data?.isDemo ? <span className="gold-price-demo">آزمایشی</span> : null}
        </strong>
      ) : (
        <span className="text-xs text-white/85">قیمت در دسترس نیست</span>
      )}
    </div>
  );
}
