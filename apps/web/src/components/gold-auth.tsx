'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle, X } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trading } from '@/lib/trading';
import { BrandMark } from './brand-mark';
import { MobileShell } from './mobile-shell';
import { OtpCodeInput } from './otp-code-input';
import { Button } from './ui/button';
import { Failure } from './trading-shell';
import { ToastViewport, useToast } from './toast-provider';

const schema = yup.object({
  phone: yup
    .string()
    .required('شماره موبایل را وارد کنید')
    .matches(/^09\d{9}$/, 'شماره موبایل معتبر وارد کنید'),
  code: yup.string().defined(),
  fullName: yup.string().defined(),
});

const inputClass =
  'mt-2 min-h-13 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base focus:border-[var(--accent)]';
const loginInputClass =
  'auth-phone-input mt-2 min-h-13 w-full rounded-md border border-white/40 bg-black/35 px-4 py-3 text-base text-white placeholder:text-white/55 focus:border-[var(--soft-gold)]';

function normalizePhone(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/\D/g, '')
    .slice(0, 11);
}

export function GoldAuth({ registering = false }: { registering?: boolean }) {
  const router = useRouter();
  const cache = useQueryClient();
  const { show } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [requestedPhone, setRequestedPhone] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const form = useForm<yup.InferType<typeof schema>>({
    resolver: yupResolver(schema),
    defaultValues: { phone: '', code: '', fullName: '' },
  });
  const request = useMutation({
    mutationFn: trading.requestOtp,
    onSuccess: (result, phone) => {
      setRequestedPhone(phone);
      setSeconds(result.expiresInSeconds);
      show({ message: 'کد تأیید ارسال شد.', tone: 'success' });
    },
  });
  const verify = useMutation({
    mutationFn: trading.verifyOtp,
    onSuccess: (user) => {
      cache.clear();
      cache.setQueryData(['session'], user);
      show({ message: 'با موفقیت وارد شدید.', tone: 'success' });
      const destination = new URLSearchParams(window.location.search).get('next');
      const safeDestination =
        destination?.startsWith('/') && !destination.startsWith('//') && !destination.includes('\\')
          ? destination
          : null;
      router.replace(safeDestination ?? (user.role === 'admin' ? '/admin' : '/'));
    },
  });

  useEffect(() => {
    if (!requestedPhone || seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [requestedPhone, seconds]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (requestedPhone && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => otpInputRef.current?.focus());
    } else if (!requestedPhone && dialog.open) {
      dialog.close();
    }
  }, [requestedPhone]);
  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    },
    []
  );

  function closeOtpSheet() {
    const dialog = dialogRef.current;
    if (!dialog?.open || dialog.dataset.closing === 'true') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dialog.close();
      return;
    }
    dialog.dataset.closing = 'true';
    closeTimerRef.current = window.setTimeout(() => dialog.close(), 240);
  }

  return (
    <MobileShell showNavigation={false}>
      <main
        className={
          registering
            ? 'net-page mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col justify-center px-5 py-10'
            : 'relative isolate flex min-h-[100dvh] flex-col justify-end overflow-hidden'
        }
      >
        {!registering && (
          <>
            <Image
              src="/auth/gold-login.png"
              alt=""
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="auth-login-image object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-black/25" aria-hidden="true" />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/10"
              aria-hidden="true"
            />
            <div className="relative z-10 flex min-h-[280px] flex-1 items-center justify-center px-5 text-white">
              <div className="flex flex-col items-center">
                <BrandMark tone="dark" size="large" animated />
                <div className="mt-5 h-px w-40 bg-[var(--soft-gold)]" aria-hidden="true" />
              </div>
            </div>
          </>
        )}
        <div
          className={
            registering
              ? 'w-full'
              : 'net-page relative z-10 mx-auto w-full max-w-[520px] px-5 pb-[max(3.5rem,env(safe-area-inset-bottom))] text-white'
          }
        >
          {registering && (
            <div className="mb-9 flex flex-col items-center">
              <BrandMark size="large" animated />
              <div className="mt-5 h-px w-16 bg-[var(--soft-gold)]" aria-hidden="true" />
            </div>
          )}
          {registering ? (
            <h1 className="mb-8 text-center text-[28px] font-semibold">ایجاد حساب</h1>
          ) : (
            <h1 className="sr-only">ورود به حساب</h1>
          )}
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit((input) => {
              if (request.isPending) return;
              if (registering && input.fullName.trim().length < 2) {
                form.setError('fullName', { message: 'نام و نام خانوادگی را وارد کنید' });
                return;
              }
              request.mutate(input.phone);
            })}
          >
            {registering && (
              <label className="block text-sm">
                نام و نام خانوادگی
                <input
                  className={inputClass}
                  autoComplete="name"
                  maxLength={100}
                  aria-invalid={!!form.formState.errors.fullName}
                  {...form.register('fullName')}
                />
                {form.formState.errors.fullName && (
                  <span className="mt-1 block text-xs text-[var(--danger)]" role="alert">
                    {form.formState.errors.fullName.message}
                  </span>
                )}
              </label>
            )}
            <label className="block text-sm">
              شماره موبایل
              <Controller
                name="phone"
                control={form.control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="tel"
                    className={`${registering ? inputClass : loginInputClass} text-left tabular-nums`}
                    dir="ltr"
                    lang="en"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={11}
                    placeholder="0912 000 0000"
                    aria-invalid={!!form.formState.errors.phone}
                    onChange={(event) => field.onChange(normalizePhone(event.target.value))}
                    onPaste={(event) => {
                      event.preventDefault();
                      field.onChange(normalizePhone(event.clipboardData.getData('text')));
                    }}
                  />
                )}
              />
              {form.formState.errors.phone && (
                <span
                  className={`mt-1 block text-xs ${registering ? 'text-[var(--danger)]' : 'text-red-200'}`}
                  role="alert"
                >
                  {form.formState.errors.phone.message}
                </span>
              )}
            </label>
            {request.error && <Failure error={request.error} />}
            <Button
              variant={registering ? 'primary' : 'gold'}
              className="w-full"
              disabled={request.isPending}
              aria-busy={request.isPending}
            >
              {request.isPending && (
                <LoaderCircle
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              )}
              {request.isPending ? 'در حال ارسال کد…' : 'دریافت کد تأیید'}
            </Button>
          </form>
          {registering && (
            <p className="mt-6 text-xs leading-6 text-[var(--muted)]">
              معامله پس از تأیید حساب توسط طلافروش فعال می‌شود.
            </p>
          )}
          <Link
            href={registering ? '/login' : '/register'}
            className={`mt-8 flex min-h-11 items-center justify-center text-sm underline underline-offset-4 ${registering ? 'text-[var(--muted)]' : 'text-white/85'}`}
          >
            {registering ? 'حساب دارید؟ ورود' : 'مشتری جدید هستید؟ ایجاد حساب'}
          </Link>
        </div>
      </main>

      <dialog
        ref={dialogRef}
        aria-labelledby="otp-title"
        onCancel={(event) => {
          event.preventDefault();
          closeOtpSheet();
        }}
        onClose={() => {
          if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
          closeTimerRef.current = null;
          if (dialogRef.current) delete dialogRef.current.dataset.closing;
          setRequestedPhone(null);
          setSeconds(0);
          form.setValue('code', '');
          verify.reset();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeOtpSheet();
        }}
        className="auth-otp-sheet fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none overflow-hidden border-0 bg-transparent p-0 text-[var(--foreground)] backdrop:bg-black/65"
      >
        <ToastViewport inDialog />
        <div className="auth-otp-panel absolute inset-x-0 bottom-0 mx-auto max-h-[90dvh] w-full max-w-[768px] overflow-y-auto rounded-t-lg bg-[var(--surface)] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 shadow-xl">
          <div
            className="mx-auto mb-5 h-1 w-10 rounded-full bg-[var(--border)]"
            aria-hidden="true"
          />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="otp-title" className="text-xl font-semibold">
                تأیید شماره موبایل
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                کد شش رقمی ارسال‌شده به <span dir="ltr">{requestedPhone}</span> را وارد کنید.
              </p>
            </div>
            <button
              type="button"
              className="grid size-11 shrink-0 place-items-center rounded-md text-[var(--muted)]"
              aria-label="بستن تأیید شماره"
              onClick={closeOtpSheet}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <form
            className="mt-7 space-y-5"
            onSubmit={form.handleSubmit((input) => {
              if (!requestedPhone || verify.isPending) return;
              if (!/^\d{6}$/.test(input.code)) {
                form.setError('code', { message: 'کد شش رقمی را وارد کنید' });
                return;
              }
              verify.mutate({
                phone: requestedPhone,
                code: input.code,
                ...(registering ? { fullName: input.fullName.trim() } : {}),
              });
            })}
          >
            <Controller
              name="code"
              control={form.control}
              render={({ field }) => (
                <OtpCodeInput
                  ref={(node) => {
                    field.ref(node);
                    otpInputRef.current = node;
                  }}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={!!form.formState.errors.code}
                />
              )}
            />
            {form.formState.errors.code && (
              <p id="otp-error" className="text-xs text-[var(--danger)]" role="alert">
                {form.formState.errors.code.message}
              </p>
            )}
            {verify.error && <Failure error={verify.error} />}
            <Button className="w-full" disabled={verify.isPending} aria-busy={verify.isPending}>
              {verify.isPending && (
                <LoaderCircle
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              )}
              {verify.isPending ? 'در حال تأیید…' : 'تأیید و ورود'}
            </Button>
          </form>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <button
              type="button"
              className="min-h-11 text-[var(--foreground)] underline underline-offset-4"
              onClick={closeOtpSheet}
            >
              ویرایش شماره
            </button>
            {seconds > 0 ? (
              <span className="text-[var(--muted)]" role="status">
                ارسال دوباره تا {seconds.toLocaleString('fa-IR')} ثانیه
              </span>
            ) : (
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 text-[var(--foreground)] underline underline-offset-4"
                disabled={request.isPending}
                aria-busy={request.isPending}
                onClick={() => requestedPhone && request.mutate(requestedPhone)}
              >
                {request.isPending && (
                  <LoaderCircle
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
                {request.isPending ? 'در حال ارسال…' : 'ارسال دوباره کد'}
              </button>
            )}
          </div>
          {request.error && (
            <div className="mt-3">
              <Failure error={request.error} />
            </div>
          )}
        </div>
      </dialog>
    </MobileShell>
  );
}
