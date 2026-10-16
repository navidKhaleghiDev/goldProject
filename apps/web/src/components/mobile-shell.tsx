'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isGuest, useSession } from '@/lib/trading';
import { BottomNav } from './bottom-nav';
import { AppHeader } from './app-header';
import { ToastNotice } from './toast-provider';

export function MobileShell({
  children,
  showNavigation = true,
  protectedPage = false,
}: {
  children: React.ReactNode;
  showNavigation?: boolean;
  protectedPage?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[var(--ivory)]">
      <div className="net-app-shell relative mx-auto min-h-screen w-full max-w-[768px] bg-[var(--ivory)]">
        {protectedPage ? (
          <ProtectedContent showNavigation={showNavigation}>{children}</ProtectedContent>
        ) : (
          <ShellContent showNavigation={showNavigation}>{children}</ShellContent>
        )}
      </div>
    </div>
  );
}

function ShellContent({
  children,
  showNavigation,
}: {
  children: React.ReactNode;
  showNavigation: boolean;
}) {
  return (
    <>
      {showNavigation ? <AppHeader /> : null}
      <div className={showNavigation ? 'pb-[env(safe-area-inset-bottom)]' : undefined}>
        {children}
      </div>
      {showNavigation ? <BottomNav /> : null}
    </>
  );
}

function ProtectedContent({
  children,
  showNavigation,
}: {
  children: React.ReactNode;
  showNavigation: boolean;
}) {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const guest = isGuest(session.error);
  useEffect(() => {
    if (guest) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [guest, pathname, router]);
  if (session.isPending || guest)
    return (
      <p className="px-5 py-8 text-sm text-[var(--muted)]" role="status">
        در حال بررسی حساب…
      </p>
    );
  if (session.error)
    return (
      <div className="px-5 py-8">
        <ToastNotice
          message="ارتباط با سرور برقرار نشد. دوباره تلاش کنید."
          tone="error"
          action={{ label: 'تلاش دوباره', onClick: () => void session.refetch() }}
        />
        <button className="underline" type="button" onClick={() => void session.refetch()}>
          تلاش دوباره
        </button>
      </div>
    );
  return <ShellContent showNavigation={showNavigation}>{children}</ShellContent>;
}
