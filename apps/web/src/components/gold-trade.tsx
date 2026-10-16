'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { GoldQuote } from '@sheri-gold/contracts';
import { grams, trading } from '@/lib/trading';
import { formatToman } from '@/lib/utils';
import { Button } from './ui/button';
import { Failure, field, panel, SessionGate, TradingShell } from './trading-shell';
import { RatesCard, WalletCard } from './gold-dashboard';
import { useToast } from './toast-provider';
const schema = yup.object({
  weightGrams: yup
    .string()
    .required('وزن را وارد کنید')
    .matches(/^\d{1,3}(\.\d{1,3})?$/, 'وزن را با ارقام انگلیسی و حداکثر سه رقم اعشار وارد کنید'),
});
export function GoldTrade({ kind }: { kind: 'buy' | 'sell' }) {
  return (
    <TradingShell title={kind === 'buy' ? 'خرید طلای آب‌شده' : 'فروش از موجودی'}>
      <SessionGate>
        {(user) =>
          user.trusted && user.role === 'customer' ? (
            <TradeForm kind={kind} />
          ) : (
            <p className={panel}>برای معامله، حساب مشتری باید توسط طلافروش تأیید شود.</p>
          )
        }
      </SessionGate>
    </TradingShell>
  );
}
function TradeForm({ kind }: { kind: 'buy' | 'sell' }) {
  const [quote, setQuote] = useState<GoldQuote | null>(null);
  const router = useRouter();
  const cache = useQueryClient();
  const { show } = useToast();
  const retry = useRef<{ weight: string; key: string } | null>(null);
  const form = useForm<yup.InferType<typeof schema>>({
    resolver: yupResolver(schema),
    defaultValues: { weightGrams: '' },
  });
  const rates = useQuery({
    queryKey: ['gold', 'rates'],
    queryFn: ({ signal }) => trading.rates(signal),
    refetchInterval: 10000,
    retry: false,
  });
  const create = useMutation({ mutationFn: trading.quote, onSuccess: setQuote });
  const accept = useMutation({
    mutationFn: trading.accept,
    onSuccess: async (result) => {
      show({ message: 'درخواست معامله ثبت شد.', tone: 'success' });
      await cache.invalidateQueries({ queryKey: ['gold'] });
      router.push(`/requests/${result.id}`);
    },
  });
  return (
    <>
      {kind === 'sell' ? <WalletCard /> : <RatesCard />}
      <ol className="flex justify-between text-xs text-[var(--muted)]" aria-label="مراحل معامله">
        <li>۱. مقدار</li>
        <li>۲. تأیید قیمت</li>
        <li>۳. {kind === 'buy' ? 'پرداخت و رسید' : 'بررسی و تسویه'}</li>
      </ol>
      {!quote ? (
        <form
          className={`${panel} space-y-4`}
          onSubmit={(event) =>
            void form.handleSubmit(async (input) => {
              if (retry.current?.weight !== input.weightGrams)
                retry.current = { weight: input.weightGrams, key: crypto.randomUUID() };
              create.mutate({
                kind,
                weightGrams: input.weightGrams,
                idempotencyKey: retry.current.key,
              });
            })(event)
          }
        >
          <label className="block text-sm" htmlFor="weight">
            وزن طلا (گرم)
          </label>
          <input
            id="weight"
            dir="ltr"
            inputMode="decimal"
            placeholder="10.000"
            className={field}
            aria-invalid={!!form.formState.errors.weightGrams}
            aria-describedby="weight-help"
            {...form.register('weightGrams')}
          />
          <p id="weight-help" className="text-xs leading-6 text-[var(--muted)]">
            {form.formState.errors.weightGrams?.message ??
              (rates.data
                ? `از ${grams(rates.data.minWeightMg)} تا ${grams(rates.data.maxWeightMg)} گرم؛ دقت ۰٫۰۰۱ گرم`
                : 'در انتظار قیمت معتبر')}
          </p>
          {create.error && <Failure error={create.error} />}
          <Button className="w-full" disabled={create.isPending || !rates.data || rates.isError}>
            {create.isPending ? 'در حال دریافت…' : 'دریافت و قفل قیمت'}
          </Button>
        </form>
      ) : (
        <section className={`${panel} space-y-4`}>
          <h2 className="font-semibold">بررسی پیش از ثبت</h2>
          <p>
            {kind === 'buy' ? 'خرید' : 'فروش'} {grams(quote.weightMg)} گرم · {quote.purity}
          </p>
          <p className="text-xl font-semibold text-[var(--teal-700)]">
            {formatToman(quote.totalToman)}
          </p>
          <p className="text-xs text-[var(--muted)]">
            نرخ هر گرم: {formatToman(quote.rateToman)} · بدون کارمزد اضافه
          </p>
          {quote.isDemo && (
            <p className="text-sm text-[var(--danger)]">حالت آزمایشی؛ وجه واقعی واریز نکنید.</p>
          )}
          <QuoteAction
            quote={quote}
            pending={accept.isPending}
            accept={() => accept.mutate(quote.id)}
            kind={kind}
          />
          {accept.error && <Failure error={accept.error} />}
          <Button
            variant="outline"
            className="w-full"
            disabled={accept.isPending}
            onClick={() => {
              setQuote(null);
              retry.current = null;
              create.reset();
              accept.reset();
            }}
          >
            ویرایش مقدار / دریافت قیمت جدید
          </Button>
        </section>
      )}
      <p className="text-xs leading-7 text-[var(--muted)]">
        {kind === 'buy'
          ? 'پس از ثبت، اطلاعات پرداخت نمایش داده می‌شود. پرداخت خارج از سامانه است و موجودی پس از بررسی رسید اضافه خواهد شد.'
          : 'با ثبت فروش، مقدار انتخاب‌شده مسدود می‌شود. مدیر پس از تسویه خارج از سامانه، معامله را تکمیل می‌کند.'}
      </p>
    </>
  );
}
function QuoteAction({
  quote,
  pending,
  accept,
  kind,
}: {
  quote: GoldQuote;
  pending: boolean;
  accept: () => void;
  kind: string;
}) {
  const [remaining, setRemaining] = useState(
    Math.max(0, Math.floor((Date.parse(quote.expiresAt) - Date.parse(quote.serverTime)) / 1000))
  );
  useEffect(() => {
    const deadline =
      performance.now() + Math.max(0, Date.parse(quote.expiresAt) - Date.parse(quote.serverTime));
    const timer = setInterval(
      () => setRemaining(Math.max(0, Math.floor((deadline - performance.now()) / 1000))),
      250
    );
    return () => clearInterval(timer);
  }, [quote]);
  return (
    <>
      <p className="text-sm">
        {remaining
          ? `اعتبار قیمت: ${remaining.toLocaleString('fa-IR')} ثانیه`
          : 'مهلت قیمت پایان یافت؛ قیمت جدید بگیرید.'}
      </p>
      <Button className="w-full" onClick={accept} disabled={!remaining || pending}>
        {pending
          ? 'در حال ثبت…'
          : kind === 'buy'
            ? 'تأیید و دریافت اطلاعات پرداخت'
            : 'تأیید فروش و مسدود کردن طلا'}
      </Button>
    </>
  );
}
