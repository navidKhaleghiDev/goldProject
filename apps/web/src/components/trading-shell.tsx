'use client';
import Link from 'next/link';
import type { SessionUser } from '@sheri-gold/contracts';
import { MobileShell } from './mobile-shell';
import { Button } from './ui/button';
import { errorMessage, isGuest, useSession } from '@/lib/trading';
import { ToastNotice } from './toast-provider';
export const panel = 'border-b border-[var(--border)] bg-transparent py-5';
export const field =
  'min-h-12 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2';
export function Failure({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <>
      <ToastNotice
        message={errorMessage(error)}
        tone="error"
        {...(retry ? { action: { label: 'تلاش دوباره', onClick: retry } } : {})}
      />
      {retry && (
        <Button variant="outline" className="mt-3" type="button" onClick={retry}>
          تلاش دوباره
        </Button>
      )}
    </>
  );
}
export function TradingShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <MobileShell protectedPage>
      <main className="net-page space-y-5 px-5 pb-28 pt-7">
        <h1 className="text-[26px] font-semibold text-[var(--foreground)]">{title}</h1>
        {children}
      </main>
    </MobileShell>
  );
}
export function SessionGate({
  children,
  admin = false,
}: {
  children: (user: SessionUser) => React.ReactNode;
  admin?: boolean;
}) {
  const session = useSession();
  if (session.isPending)
    return (
      <p role="status" className={panel}>
        در حال دریافت حساب…
      </p>
    );
  if (session.error) {
    if (!isGuest(session.error))
      return <Failure error={session.error} retry={() => void session.refetch()} />;
    return (
      <section className={panel}>
        <h2 className="font-semibold">خرید و فروش برای مشتریان مورد اعتماد</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
          برای مشاهده موجودی و ثبت معامله وارد شوید. حساب‌های جدید پس از تأیید طلافروش امکان معامله
          دارند.
        </p>
        <Link
          href="/login"
          className="mt-4 flex min-h-12 items-center justify-center rounded-md bg-[var(--foreground)] p-3 text-center text-[var(--ivory)]"
        >
          ورود / ثبت‌نام
        </Link>
      </section>
    );
  }
  if (admin && session.data.role !== 'admin')
    return (
      <>
        <ToastNotice message="این بخش فقط برای مدیر است." tone="error" />
        <p className={panel}>دسترسی به این بخش مجاز نیست.</p>
      </>
    );
  return children(session.data);
}
