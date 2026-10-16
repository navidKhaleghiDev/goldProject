'use client';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { trading } from '@/lib/trading';
import { Button } from './ui/button';
import { Failure, panel, SessionGate, TradingShell } from './trading-shell';
import { PwaInstallCard } from './pwa-provider';
import { useToast } from './toast-provider';
export function GoldAccount() {
  const cache = useQueryClient();
  const router = useRouter();
  const { show } = useToast();
  const logout = useMutation({
    mutationFn: trading.logout,
    onSuccess: () => {
      cache.clear();
      show({ message: 'از حساب خارج شدید.', tone: 'success' });
      router.replace('/login');
    },
  });
  return (
    <TradingShell title="حساب کاربری">
      <PwaInstallCard />
      <SessionGate>
        {(user) => (
          <>
            <section className={`${panel} space-y-3`}>
              <h2 className="font-semibold">{user.fullName}</h2>
              <p dir="ltr">{user.phone}</p>
              <p className="text-sm">
                {user.role === 'admin'
                  ? 'مدیر طلافروشی'
                  : user.trusted
                    ? 'مشتری مورد اعتماد'
                    : 'در انتظار تأیید طلافروش'}
              </p>
            </section>
            {user.role === 'admin' && (
              <Link href="/admin" className={`${panel} block`}>
                مدیریت مشتریان و معاملات
              </Link>
            )}
            <Link href="/activity" className={`${panel} block`}>
              فعالیت‌ها و سفارش‌ها
            </Link>
            <Link href="/trade/buy#orders" className={`${panel} block`}>
              معامله و کیف پول
            </Link>
            {logout.error && <Failure error={logout.error} />}
            <Button
              variant="outline"
              className="w-full"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              خروج از حساب
            </Button>
          </>
        )}
      </SessionGate>
    </TradingShell>
  );
}
