'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { Button } from './ui/button';
import { useToast } from './toast-provider';

interface InstallPrompt extends Event {
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}
interface PwaState {
  installed: boolean;
  canInstall: boolean;
  installing: boolean;
  updateReady: boolean;
  error: string;
  install(): Promise<void>;
  update(): void;
}
const PwaContext = createContext<PwaState | null>(null);

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const { show, dismiss } = useToast();
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [offline, setOffline] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [error, setError] = useState('');
  const requestedUpdate = useRef(false);

  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)');
    const updateInstalled = () =>
      setInstalled(
        display.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
      );
    const updateOnline = () => setOffline(!navigator.onLine);
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const afterInstall = () => {
      setInstalled(true);
      setPrompt(null);
      show({ message: 'برنامه نصب شد.', tone: 'success' });
    };
    updateInstalled();
    updateOnline();
    display.addEventListener('change', updateInstalled);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', afterInstall);
    return () => {
      display.removeEventListener('change', updateInstalled);
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', afterInstall);
    };
  }, [show]);

  useEffect(() => {
    if (!offline) return;
    const id = show({
      message:
        'اتصال قطع است؛ قیمت و موجودی ممکن است قدیمی باشند. برای معامله به اینترنت متصل شوید.',
      tone: 'info',
      duration: 0,
    });
    return () => dismiss(id);
  }, [offline, show, dismiss]);

  useEffect(() => {
    if (error) show({ message: error, tone: 'error' });
  }, [error, show]);

  useEffect(() => {
    if (waiting)
      show({
        message: 'نسخه جدید برنامه آماده است. پس از پایان کار می‌توانید آن را به‌روزرسانی کنید.',
        tone: 'info',
      });
  }, [waiting, show]);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      !('serviceWorker' in navigator) ||
      !window.isSecureContext
    )
      return;
    let active = true;
    let registration: ServiceWorkerRegistration | undefined;
    let installingWorker: ServiceWorker | null = null;
    const checkWaiting = () => {
      if (active && registration?.waiting) setWaiting(registration.waiting);
    };
    const watchUpdate = () => {
      installingWorker?.removeEventListener('statechange', checkWaiting);
      installingWorker = registration?.installing ?? null;
      installingWorker?.addEventListener('statechange', checkWaiting);
    };
    const controllerChanged = () => {
      if (requestedUpdate.current) window.location.reload();
    };
    const checkUpdates = () => {
      if (document.visibilityState === 'visible' && navigator.onLine)
        void registration?.update().catch(() => undefined);
    };
    navigator.serviceWorker.addEventListener('controllerchange', controllerChanged);
    document.addEventListener('visibilitychange', checkUpdates);
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((result) => {
        if (!active) return;
        registration = result;
        checkWaiting();
        watchUpdate();
        result.addEventListener('updatefound', watchUpdate);
      })
      .catch(() => {
        if (active) setError('آماده‌سازی نصب کامل نشد. اتصال را بررسی و صفحه را دوباره باز کنید.');
      });
    return () => {
      active = false;
      registration?.removeEventListener('updatefound', watchUpdate);
      installingWorker?.removeEventListener('statechange', checkWaiting);
      navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged);
      document.removeEventListener('visibilitychange', checkUpdates);
    };
  }, []);

  async function install() {
    if (!prompt || installing) return;
    setInstalling(true);
    setError('');
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      setError('نصب انجام نشد. از منوی مرورگر گزینه نصب برنامه را انتخاب کنید.');
    } finally {
      setPrompt(null);
      setInstalling(false);
    }
  }
  function update() {
    if (!waiting) return;
    requestedUpdate.current = true;
    waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
  }
  return (
    <PwaContext.Provider
      value={{
        installed,
        canInstall: Boolean(prompt),
        installing,
        updateReady: Boolean(waiting),
        error,
        install,
        update,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}

export function PwaInstallCard() {
  const pwa = useContext(PwaContext);
  const mutations = useIsMutating();
  if (!pwa) return null;
  return (
    <section
      className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-5"
      aria-labelledby="install-title"
    >
      <h2 id="install-title" className="font-semibold">
        {pwa.installed ? 'نت گلد روی دستگاه شما' : 'نصب نت گلد'}
      </h2>
      <p className="text-sm leading-7 text-[var(--muted)]">
        {pwa.installed
          ? 'برنامه از صفحه اصلی دستگاه باز شده است.'
          : 'نت گلد را به صفحه اصلی اضافه کنید تا سریع‌تر به حساب خود دسترسی داشته باشید.'}
      </p>
      {!pwa.installed &&
        (pwa.canInstall ? (
          <Button
            type="button"
            className="w-full"
            disabled={pwa.installing}
            onClick={() => void pwa.install()}
          >
            {pwa.installing ? 'در حال نصب…' : 'نصب برنامه'}
          </Button>
        ) : (
          <div className="space-y-2 text-xs leading-7 text-[var(--muted)]">
            <p>
              آیفون و آیپد: در Safari، گزینه اشتراک‌گذاری و سپس «افزودن به صفحه اصلی» (Add to Home
              Screen) را انتخاب کنید.
            </p>
            <p>
              اندروید و رایانه: در منوی مرورگر، گزینه «نصب برنامه» یا «افزودن به صفحه اصلی» را
              انتخاب کنید؛ نمایش این گزینه به مرورگر بستگی دارد.
            </p>
          </div>
        ))}
      {pwa.updateReady && (
        <>
          <Button type="button" variant="outline" disabled={mutations > 0} onClick={pwa.update}>
            به‌روزرسانی برنامه
          </Button>
        </>
      )}
    </section>
  );
}
