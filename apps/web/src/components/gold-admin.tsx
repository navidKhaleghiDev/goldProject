'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trading } from '@/lib/trading';
import { Button } from './ui/button';
import { Failure, panel, SessionGate, TradingShell } from './trading-shell';
import { useToast } from './toast-provider';
import { TransactionList } from './gold-history';
import { PlatformAdmin } from './platform-dashboard';
export function GoldAdmin() {
  return (
    <TradingShell title="مدیریت طلافروشی">
      <SessionGate admin>{() => <AdminContent />}</SessionGate>
    </TradingShell>
  );
}
function AdminContent() {
  const [tab, setTab] = useState('platform');
  return (
    <>
      <div className="flex gap-2">
        <Button
          variant={tab === 'platform' ? 'primary' : 'outline'}
          onClick={() => setTab('platform')}
        >
          معاملات جدید
        </Button>
        <Button
          variant={tab === 'transactions' ? 'primary' : 'outline'}
          onClick={() => setTab('transactions')}
        >
          معاملات
        </Button>
        <Button
          variant={tab === 'customers' ? 'primary' : 'outline'}
          onClick={() => setTab('customers')}
        >
          مشتریان مورد اعتماد
        </Button>
      </div>
      {tab === 'platform' ? (
        <PlatformAdmin />
      ) : tab === 'transactions' ? (
        <TransactionList />
      ) : (
        <Customers />
      )}
    </>
  );
}
function Customers() {
  const [page, setPage] = useState(1);
  const cache = useQueryClient();
  const { show } = useToast();
  const query = useQuery({
    queryKey: ['gold', 'customers', page],
    queryFn: ({ signal }) => trading.customers(page, signal),
  });
  const mutation = useMutation({
    mutationFn: ({ id, trusted }: { id: string; trusted: boolean }) => trading.trust(id, trusted),
    onSuccess: () => {
      show({ message: 'وضعیت مشتری به‌روز شد.', tone: 'success' });
      return cache.invalidateQueries({ queryKey: ['gold', 'customers'] });
    },
  });
  return (
    <>
      {mutation.error && <Failure error={mutation.error} />}
      <p className="text-sm leading-7 text-[var(--muted)]">
        هویت و رابطه مشتری را خارج از سامانه بررسی کنید. با تأیید اعتماد، خرید و فروش برای او فعال
        می‌شود.
      </p>
      {query.isPending ? (
        <p role="status">در حال دریافت مشتریان…</p>
      ) : query.error ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data.length && <p className={panel}>مشتری جدیدی وجود ندارد.</p>}
          {query.data.map((user) => (
            <article key={user.id} className={`${panel} space-y-3`}>
              <strong>{user.fullName}</strong>
              <p className="text-sm" dir="ltr">
                {user.phone}
              </p>
              <p className="text-xs">{user.trusted ? 'مورد اعتماد' : 'در انتظار تأیید'}</p>
              <Button
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ id: user.id, trusted: !user.trusted })}
              >
                {user.trusted ? 'لغو دسترسی معامله' : 'تأیید اعتماد و فعال‌سازی'}
              </Button>
            </article>
          ))}
          <div className="flex justify-between">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              قبلی
            </Button>
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
