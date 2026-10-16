'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastTone = 'error' | 'success' | 'info';
type ToastInput = {
  message: string;
  tone?: ToastTone;
  duration?: number;
  action?: { label: string; onClick: () => void };
};
type ToastItem = ToastInput & { id: number };
type ToastContextValue = {
  toasts: ToastItem[];
  show: (input: ToastInput) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const lastToast = useRef<{ key: string; at: number; id: number } | null>(null);
  const dismiss = useCallback((id: number) => {
    if (lastToast.current?.id === id) lastToast.current = null;
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const show = useCallback((input: ToastInput) => {
    const key = `${input.tone ?? 'info'}:${input.message}`;
    const now = Date.now();
    if (lastToast.current?.key === key && now - lastToast.current.at < 2000) {
      return lastToast.current.id;
    }
    const id = ++nextId.current;
    lastToast.current = { key, at: now, id };
    setToasts((current) => [...current.slice(-2), { ...input, id }]);
    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, show, dismiss }}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('ToastProvider is required');
  return context;
}

export function ToastNotice({ message, tone = 'info', duration, action }: ToastInput) {
  const { show } = useToast();
  const actionRef = useRef(action?.onClick);
  useEffect(() => {
    actionRef.current = action?.onClick;
  }, [action]);
  const actionLabel = action?.label;
  useEffect(() => {
    show({
      message,
      tone,
      ...(duration !== undefined ? { duration } : {}),
      ...(actionLabel
        ? { action: { label: actionLabel, onClick: () => actionRef.current?.() } }
        : {}),
    });
  }, [show, message, tone, duration, actionLabel]);
  return null;
}

export function ToastViewport({ inDialog = false }: { inDialog?: boolean }) {
  const { toasts, dismiss } = useToast();
  if (!toasts.length) return null;
  return (
    <div
      className={cn(
        'toast-viewport pointer-events-none fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[200] mx-auto flex w-auto max-w-[520px] flex-col gap-2',
        inDialog ? 'toast-viewport-dialog' : 'toast-viewport-global'
      )}
      aria-label="اعلان‌ها"
    >
      {toasts.map((toast) => (
        <ToastMessage key={toast.id} toast={toast} dismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastMessage({ toast, dismiss }: { toast: ToastItem; dismiss: (id: number) => void }) {
  useEffect(() => {
    if (toast.duration === 0) return;
    const timer = window.setTimeout(() => dismiss(toast.id), toast.duration ?? 6500);
    return () => window.clearTimeout(timer);
  }, [dismiss, toast.duration, toast.id]);
  const tone = toast.tone ?? 'info';
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'toast-enter pointer-events-auto flex items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--foreground)] shadow-lg',
        tone === 'error' && 'border-r-[3px] border-r-[var(--danger)]',
        tone === 'success' && 'border-r-[3px] border-r-[var(--success)]',
        tone === 'info' && 'border-r-[3px] border-r-[var(--accent)]'
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 shrink-0',
          tone === 'error'
            ? 'text-[var(--danger)]'
            : tone === 'success'
              ? 'text-[var(--success)]'
              : 'text-[var(--accent)]'
        )}
        size={18}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 leading-6">
        <p>{toast.message}</p>
        {toast.action && (
          <button
            type="button"
            className="mt-1 min-h-8 font-semibold text-[var(--foreground)] underline underline-offset-4"
            onClick={() => {
              toast.action?.onClick();
              dismiss(toast.id);
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        className="grid size-8 shrink-0 place-items-center"
        aria-label="بستن اعلان"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
