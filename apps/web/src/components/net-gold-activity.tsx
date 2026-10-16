'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { platform } from '@/lib/platform';
import { Failure, SessionGate, TradingShell } from './trading-shell';

const states: Record<string, string> = {
  pending_payment: 'در انتظار پرداخت', payment_review: 'بررسی رسید', correction_window: 'مهلت اصلاح رسید',
  admin_review: 'در انتظار بررسی', completed: 'تکمیل‌شده', expired: 'منقضی‌شده', rejected: 'ردشده',
};

function Orders() {
  const orders = useQuery({ queryKey: ['platform', 'orders'], queryFn: ({ signal }) => platform.orders(signal) });
  if (orders.isPending) return <p role="status" className="py-6 text-sm text-[var(--muted)]">در حال دریافت فعالیت…</p>;
  if (orders.error) return <Failure error={orders.error} retry={() => void orders.refetch()} />;
  if (!orders.data?.length) return <section className="border-t border-[var(--border)] py-8"><p className="text-sm text-[var(--muted)]">هنوز معامله‌ای ثبت نشده است.</p><Link href="/trade/buy" className="mt-5 inline-block border-b border-[var(--accent)] text-sm">شروع خرید طلا</Link></section>;
  return <ul className="border-t border-[var(--border)]">
    {orders.data.map(order => <li key={order.id} className="border-b border-[var(--border)] py-5">
      <div className="flex items-start justify-between gap-4">
        <div><p className="font-medium">{order.side === 'buy' ? 'خرید' : 'فروش'} {(Number(order.quantityMg) / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 3 })} گرم · {order.assetCode}</p><p className="mt-2 text-xs text-[var(--muted)]">{new Date(order.createdAt).toLocaleString('fa-IR')} · {states[order.state] ?? order.state}</p></div>
        <p className="shrink-0 text-sm tabular-nums">{BigInt(order.totalToman).toLocaleString('fa-IR')} <span className="text-xs text-[var(--muted)]">تومان</span></p>
      </div>
      {['pending_payment', 'correction_window'].includes(order.state) && <Link href="/trade/buy#orders" className="mt-3 inline-block text-xs text-[var(--accent)] underline underline-offset-4">پیگیری سفارش</Link>}
    </li>)}
  </ul>;
}

export function NetGoldActivity() {
  return <TradingShell title="فعالیت‌ها"><SessionGate>{user => user.role === 'admin' ? <Link href="/admin">مشاهده مدیریت</Link> : <Orders />}</SessionGate></TradingShell>;
}
