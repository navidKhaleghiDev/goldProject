'use client';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platform, type PriceLock, type Wallet } from '@/lib/platform';
import { api } from '@/lib/api';
import { Button } from './ui/button';
import { Failure, field, panel, SessionGate, TradingShell } from './trading-shell';
import { useToast } from './toast-provider';

const amount = (value: string | number) => BigInt(value).toLocaleString('fa-IR');
const grams = (mg: string) =>
  `${(Number(mg) / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 3 })} گرم`;
const state: Record<string, string> = {
  pending_payment: 'در انتظار پرداخت',
  payment_review: 'بررسی رسید',
  correction_window: 'مهلت اصلاح رسید',
  admin_review: 'بررسی طلافروش',
  completed: 'تکمیل‌شده',
  expired: 'منقضی‌شده',
  rejected: 'ردشده',
};

function QuoteReview({
  lock,
  pending,
  onCreate,
}: {
  lock: PriceLock;
  pending: boolean;
  onCreate: () => void;
}) {
  const [remaining, setRemaining] = useState(
    Math.max(0, Math.ceil((Date.parse(lock.expires_at) - Date.parse(lock.server_time)) / 1000))
  );
  useEffect(() => {
    const duration = Math.max(0, Date.parse(lock.expires_at) - Date.parse(lock.server_time));
    const deadline = performance.now() + duration;
    const update = () =>
      setRemaining(Math.max(0, Math.ceil((deadline - performance.now()) / 1000)));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [lock.id, lock.expires_at, lock.server_time]);
  return (
    <div className="rounded-xl border border-[var(--border)] p-4 space-y-2">
      <p>جمع: {amount(lock.total_toman)} تومان</p>
      <p className="text-xs" role="status">
        {remaining
          ? `اعتبار قیمت: ${remaining.toLocaleString('fa-IR')} ثانیه`
          : 'مهلت قیمت پایان یافت؛ قیمت جدید بگیرید.'}
      </p>
      <Button disabled={!remaining || pending} onClick={onCreate}>
        ثبت سفارش
      </Button>
    </div>
  );
}

function WalletHistory({ wallet }: { wallet: Wallet }) {
  const [open, setOpen] = useState(false);
  const history = useQuery({
    queryKey: ['platform', 'ledger', wallet.id],
    queryFn: ({ signal }) => platform.ledger(wallet.id, signal),
    enabled: open,
  });
  return (
    <div className="border-t border-[var(--border)] pt-2 text-sm">
      <p>{wallet.kind === 'cash' ? 'وجه نقد (تومان)' : `طلا ${wallet.assetCode}`}</p>
      <p>
        قابل استفاده: {wallet.kind === 'cash' ? amount(wallet.available) : grams(wallet.available)}{' '}
        · مسدود: {wallet.kind === 'cash' ? amount(wallet.held) : grams(wallet.held)}
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-2"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? 'بستن گردش حساب' : 'نمایش گردش حساب'}
      </Button>
      {open &&
        (history.isPending ? (
          <p role="status">در حال دریافت گردش حساب…</p>
        ) : history.error ? (
          <Failure error={history.error} retry={() => void history.refetch()} />
        ) : !history.data?.length ? (
          <p>گردشی ثبت نشده است.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {history.data.map((entry) => (
              <li key={entry.id} className="rounded-lg bg-[var(--ivory)] p-2">
                <span>{entry.action}</span>
                <span className="block text-xs">
                  {new Date(entry.createdAt).toLocaleString('fa-IR')} · تغییر قابل استفاده{' '}
                  {entry.availableDelta} · تغییر مسدود {entry.heldDelta}
                </span>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

export function PlatformDashboard({ initialSide = 'buy' }: { initialSide?: 'buy' | 'sell' }) {
  return (
    <TradingShell title={initialSide === 'buy' ? 'خرید طلا' : 'فروش طلا'}>
      <SessionGate>
        {(user) =>
          user.role === 'admin' ? (
            <PlatformAdmin />
          ) : (
            <CustomerPlatform trusted={user.trusted} initialSide={initialSide} />
          )
        }
      </SessionGate>
    </TradingShell>
  );
}
function CustomerPlatform({
  trusted,
  initialSide,
}: {
  trusted: boolean;
  initialSide: 'buy' | 'sell';
}) {
  const cache = useQueryClient();
  const { show } = useToast();
  const [side, setSide] = useState<'buy' | 'sell'>(initialSide);
  const [assetId, setAssetId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [lock, setLock] = useState<PriceLock | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [walletToman, setWalletToman] = useState('0');
  const [iban, setIban] = useState('');
  const [holderName, setHolderName] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [withdrawToman, setWithdrawToman] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<{ id: string; file: File } | null>(null);
  const quoteRequest = useRef<{ signature: string; key: string } | null>(null);
  const withdrawRequest = useRef<{ signature: string; key: string } | null>(null);
  const catalog = useQuery({
    queryKey: ['platform', 'assets'],
    queryFn: ({ signal }) => platform.assets(signal),
  });
  const wallets = useQuery({
    queryKey: ['platform', 'wallets'],
    queryFn: ({ signal }) => platform.wallets(signal),
  });
  const orders = useQuery({
    queryKey: ['platform', 'orders'],
    queryFn: ({ signal }) => platform.orders(signal),
  });
  const detail = useQuery({
    queryKey: ['platform', 'order', selectedOrder],
    queryFn: ({ signal }) => platform.order(selectedOrder!, signal),
    enabled: !!selectedOrder,
  });
  const banks = useQuery({
    queryKey: ['platform', 'banks'],
    queryFn: ({ signal }) => platform.bankAccounts(signal),
  });
  const withdrawals = useQuery({
    queryKey: ['platform', 'withdrawals'],
    queryFn: ({ signal }) => platform.withdrawals(signal),
  });
  const refresh = () => cache.invalidateQueries({ queryKey: ['platform'] });
  const quote = useMutation({
    mutationFn: platform.priceLock,
    onSuccess: (result, variables) => {
      const signature = `${variables.side}:${variables.assetId}:${variables.unitId}:${variables.quantity}`;
      if (quoteRequest.current?.signature === signature) setLock(result);
    },
  });
  const create = useMutation({
    mutationFn: platform.createOrder,
    onSuccess: async (result) => {
      setLock(null);
      quoteRequest.current = null;
      setSelectedOrder(result.id);
      show({ message: 'سفارش ثبت شد و در انتظار ادامه پرداخت است.', tone: 'success' });
      await refresh();
    },
  });
  const payments = useMutation({
    mutationFn: ({ id, wallet, bank }: { id: string; wallet: number; bank: number }) =>
      platform.payments(id, wallet, bank),
    onSuccess: async () => {
      show({ message: 'روش پرداخت ثبت شد.', tone: 'success' });
      await refresh();
    },
  });
  const receipt = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => platform.receipt(id, file),
    onSuccess: async () => {
      setSelectedReceipt(null);
      show({ message: 'رسید برای بررسی ارسال شد.', tone: 'success' });
      await refresh();
    },
  });
  const addBank = useMutation({
    mutationFn: () => platform.addBank(iban, holderName),
    onSuccess: async (result) => {
      setBankAccountId(result.id);
      setIban('');
      setHolderName('');
      show({ message: 'حساب بانکی اضافه شد.', tone: 'success' });
      await refresh();
    },
  });
  const withdraw = useMutation({
    mutationFn: () => {
      const signature = `${bankAccountId}:${withdrawToman}`;
      if (withdrawRequest.current?.signature !== signature)
        withdrawRequest.current = { signature, key: crypto.randomUUID() };
      return platform.withdraw(bankAccountId, Number(withdrawToman), withdrawRequest.current.key);
    },
    onSuccess: async () => {
      setWithdrawToman('');
      withdrawRequest.current = null;
      show({ message: 'درخواست برداشت ثبت شد.', tone: 'success' });
      await refresh();
    },
  });
  const cash = wallets.data?.find((w) => w.kind === 'cash');
  const selected = detail.data;
  const bankPayment = selected?.payments?.find((p) => p.method === 'bank_transfer');
  const error =
    quote.error ??
    create.error ??
    payments.error ??
    receipt.error ??
    addBank.error ??
    withdraw.error;
  return (
    <>
      {!trusted && (
        <p role="status" className={panel}>
          حساب شما در انتظار تأیید طلافروش است. تاریخچه و موجودی همچنان در دسترس است.
        </p>
      )}
      {catalog.data?.isDemo && (
        <p role="status" className={`${panel} text-[var(--danger)]`}>
          قیمت‌ها آزمایشی هستند. وجه واقعی واریز نکنید.
        </p>
      )}
      {error && <Failure error={error} />}
      <section className={`${panel} space-y-4`}>
        <h2 className="font-semibold">خرید و فروش طلا</h2>
        {catalog.isPending ? (
          <p role="status">در حال دریافت عیارها…</p>
        ) : catalog.error ? (
          <Failure error={catalog.error} retry={() => void catalog.refetch()} />
        ) : !catalog.data?.assets.length ? (
          <p>هنوز عیار و قیمت آزمایشی توسط مدیر ثبت نشده است.</p>
        ) : (
          <>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={side === 'buy' ? 'primary' : 'outline'}
                onClick={() => {
                  setSide('buy');
                  setLock(null);
                  quoteRequest.current = null;
                }}
              >
                خرید
              </Button>
              <Button
                type="button"
                variant={side === 'sell' ? 'primary' : 'outline'}
                onClick={() => {
                  setSide('sell');
                  setLock(null);
                  quoteRequest.current = null;
                }}
              >
                فروش
              </Button>
            </div>
            <label className="block text-sm">
              عیار طلا
              <select
                className={`${field} mt-2`}
                value={assetId}
                onChange={(e) => {
                  setAssetId(e.target.value);
                  setLock(null);
                  quoteRequest.current = null;
                }}
              >
                <option value="">انتخاب عیار</option>
                {catalog.data.assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.purity})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              واحد
              <select
                className={`${field} mt-2`}
                value={unitId}
                onChange={(e) => {
                  setUnitId(e.target.value);
                  setLock(null);
                  quoteRequest.current = null;
                }}
              >
                <option value="">انتخاب واحد</option>
                {catalog.data.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              مقدار
              <input
                className={`${field} mt-2`}
                dir="ltr"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setLock(null);
                  quoteRequest.current = null;
                }}
              />
            </label>
            {assetId && (
              <p className="text-xs">
                نرخ هر گرم:{' '}
                {amount(
                  side === 'buy'
                    ? (catalog.data.assets.find((a) => a.id === assetId)?.buyTomanPerGram ?? 0)
                    : (catalog.data.assets.find((a) => a.id === assetId)?.sellTomanPerGram ?? 0)
                )}{' '}
                تومان
              </p>
            )}
            <Button
              disabled={!trusted || !assetId || !unitId || !quantity || quote.isPending}
              onClick={() => {
                const signature = `${side}:${assetId}:${unitId}:${quantity}`;
                if (quoteRequest.current?.signature !== signature)
                  quoteRequest.current = { signature, key: crypto.randomUUID() };
                quote.mutate({
                  side,
                  assetId,
                  unitId,
                  quantity,
                  idempotencyKey: quoteRequest.current.key,
                });
              }}
            >
              دریافت قیمت قفل‌شده
            </Button>
            {lock && (
              <QuoteReview
                key={lock.id}
                lock={lock}
                pending={create.isPending}
                onCreate={() => create.mutate(lock.id)}
              />
            )}
          </>
        )}
      </section>
      <section id="wallets" className={`${panel} space-y-3`}>
        <h2 className="font-semibold">کیف پول</h2>
        {wallets.isPending ? (
          <p role="status">در حال دریافت موجودی…</p>
        ) : wallets.error ? (
          <Failure error={wallets.error} retry={() => void wallets.refetch()} />
        ) : wallets.data?.length ? (
          wallets.data.map((w) => <WalletHistory key={w.id} wallet={w} />)
        ) : (
          <p>موجودی ثبت نشده است.</p>
        )}
      </section>
      <section id="orders" className={`${panel} space-y-3`}>
        <h2 className="font-semibold">سفارش‌ها</h2>
        {orders.isPending ? (
          <p role="status">در حال دریافت سفارش‌ها…</p>
        ) : orders.error ? (
          <Failure error={orders.error} retry={() => void orders.refetch()} />
        ) : !orders.data?.length ? (
          <p>سفارشی ثبت نشده است.</p>
        ) : (
          orders.data.map((o) => (
            <button
              key={o.id}
              type="button"
              className="block w-full rounded-xl border border-[var(--border)] p-3 text-right focus-visible:outline-2"
              onClick={() => setSelectedOrder(o.id)}
            >
              <strong>
                {o.side === 'buy' ? 'خرید' : 'فروش'} {grams(o.quantityMg)} {o.assetCode}
              </strong>
              <span className="block text-xs">
                {state[o.state] ?? o.state} · {amount(o.totalToman)} تومان
              </span>
            </button>
          ))
        )}
        {selectedOrder && (
          <div className="border-t border-[var(--border)] pt-4 space-y-3">
            {detail.isPending ? (
              <p role="status">در حال دریافت جزئیات…</p>
            ) : detail.error ? (
              <Failure error={detail.error} retry={() => void detail.refetch()} />
            ) : (
              selected && (
                <>
                  <h3 className="font-semibold">جزئیات سفارش {selected.id.slice(0, 8)}</h3>
                  <p>{state[selected.state] ?? selected.state}</p>
                  {selected.rejectionReason && (
                    <p role="alert">علت رد: {selected.rejectionReason}</p>
                  )}
                  {selected.state === 'pending_payment' &&
                    selected.side === 'buy' &&
                    !selected.payments?.length && (
                      <div className="space-y-2">
                        <p>جمع سفارش: {amount(selected.totalToman)} تومان</p>
                        <label className="block text-sm">
                          مبلغ از کیف پول (تومان)
                          <input
                            className={`${field} mt-2`}
                            dir="ltr"
                            inputMode="numeric"
                            value={walletToman}
                            onChange={(e) => setWalletToman(e.target.value)}
                          />
                        </label>
                        <p>
                          انتقال بانکی:{' '}
                          {amount(
                            Math.max(0, Number(selected.totalToman) - Number(walletToman || 0))
                          )}{' '}
                          تومان
                        </p>
                        <Button
                          disabled={
                            payments.isPending ||
                            !/^\d+$/.test(walletToman) ||
                            Number(walletToman) > Number(selected.totalToman)
                          }
                          onClick={() =>
                            payments.mutate({
                              id: selected.id,
                              wallet: Number(walletToman),
                              bank: Number(selected.totalToman) - Number(walletToman),
                            })
                          }
                        >
                          ثبت روش پرداخت
                        </Button>
                      </div>
                    )}
                  {bankPayment &&
                    ['pending_receipt', 'rejected'].includes(bankPayment.state) &&
                    ['pending_payment', 'correction_window'].includes(selected.state) && (
                      <div className="space-y-2">
                        <p>مبلغ انتقال بانکی: {amount(bankPayment.amountToman)} تومان</p>
                        <p className="text-sm">{selected.paymentInstructions}</p>
                        {selected.correctionDeadline && (
                          <p className="text-sm">
                            مهلت اصلاح تا{' '}
                            {new Date(selected.correctionDeadline).toLocaleString('fa-IR')}
                          </p>
                        )}
                        <label className="block text-sm">
                          تصویر رسید (PNG/JPEG، حداکثر ۵ مگابایت)
                          <input
                            className="mt-2 block w-full"
                            type="file"
                            accept="image/png,image/jpeg"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              setSelectedReceipt(file ? { id: bankPayment.id, file } : null);
                            }}
                          />
                        </label>
                        <Button
                          type="button"
                          disabled={
                            !selectedReceipt ||
                            selectedReceipt.id !== bankPayment.id ||
                            receipt.isPending
                          }
                          onClick={() => {
                            if (selectedReceipt) receipt.mutate(selectedReceipt);
                          }}
                        >
                          ارسال رسید برای بررسی
                        </Button>
                      </div>
                    )}
                  {selected.receipts?.map((r) => (
                    <p key={r.id} className="text-xs">
                      رسید {new Date(r.createdAt).toLocaleString('fa-IR')}: {r.state}
                      {r.rejectionReason ? ` — ${r.rejectionReason}` : ''}
                    </p>
                  ))}
                </>
              )
            )}
          </div>
        )}
      </section>
      <section className={`${panel} space-y-3`}>
        <h2 className="font-semibold">برداشت وجه</h2>
        <p className="text-xs">پس از فروش و تأیید طلافروش، وجه به کیف پول نقدی افزوده می‌شود.</p>
        <label className="block text-sm">
          شماره شبا
          <input
            className={`${field} mt-2`}
            dir="ltr"
            placeholder="IR..."
            value={iban}
            onChange={(e) => setIban(e.target.value.toUpperCase())}
          />
        </label>
        <label className="block text-sm">
          نام صاحب حساب
          <input
            className={`${field} mt-2`}
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
          />
        </label>
        <Button
          variant="outline"
          disabled={!/^IR\d{24}$/.test(iban) || holderName.trim().length < 2 || addBank.isPending}
          onClick={() => addBank.mutate()}
        >
          افزودن حساب بانکی
        </Button>
        <label className="block text-sm">
          حساب مقصد
          <select
            className={`${field} mt-2`}
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
          >
            <option value="">انتخاب حساب</option>
            {banks.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.holderName} · {b.iban.slice(-4)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          مبلغ برداشت (تومان)
          <input
            className={`${field} mt-2`}
            dir="ltr"
            inputMode="numeric"
            value={withdrawToman}
            onChange={(e) => setWithdrawToman(e.target.value)}
          />
        </label>
        <Button
          disabled={
            !trusted ||
            !bankAccountId ||
            !/^\d+$/.test(withdrawToman) ||
            Number(withdrawToman) <= 0 ||
            Number(withdrawToman) > Number(cash?.available ?? 0) ||
            withdraw.isPending
          }
          onClick={() => withdraw.mutate()}
        >
          درخواست برداشت
        </Button>
        {withdrawals.data?.map((w) => (
          <p key={w.id} className="text-sm">
            {amount(w.amountToman)} تومان · شبا …{w.ibanLastFour} · {w.state}
          </p>
        ))}
      </section>
    </>
  );
}

export function PlatformAdmin() {
  const cache = useQueryClient();
  const { show } = useToast();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [purity, setPurity] = useState('');
  const [buy, setBuy] = useState('');
  const [sell, setSell] = useState('');
  const [reason, setReason] = useState('');
  const [payoutReference, setPayoutReference] = useState('');
  const assets = useQuery({
    queryKey: ['platform', 'assets'],
    queryFn: ({ signal }) => platform.assets(signal),
  });
  const orders = useQuery({
    queryKey: ['platform', 'admin', 'orders'],
    queryFn: ({ signal }) => platform.adminOrders(signal),
  });
  const withdrawals = useQuery({
    queryKey: ['platform', 'admin', 'withdrawals'],
    queryFn: ({ signal }) => platform.adminWithdrawals(signal),
  });
  const refresh = () => cache.invalidateQueries({ queryKey: ['platform'] });
  const update = useMutation({
    mutationFn: () =>
      platform.setAsset({
        code,
        name,
        purity,
        buyTomanPerGram: Number(buy),
        sellTomanPerGram: Number(sell),
      }),
    onSuccess: async () => {
      show({ message: 'نرخ طلا ثبت شد.', tone: 'success' });
      await refresh();
    },
  });
  const decision = useMutation({
    mutationFn: ({
      type,
      id,
      value,
    }: {
      type: 'order' | 'payment' | 'withdrawal';
      id: string;
      value: 'approve' | 'reject';
    }) =>
      type === 'order'
        ? platform.decideOrder(id, value, reason)
        : type === 'payment'
          ? platform.decidePayment(id, value, reason)
          : platform.decideWithdrawal(id, value, reason, payoutReference),
    onSuccess: async () => {
      show({ message: 'نتیجه بررسی ثبت شد.', tone: 'success' });
      await refresh();
    },
  });
  return (
    <>
      <section className={`${panel} space-y-3`}>
        <h2 className="font-semibold">عیارها و قیمت آزمایشی</h2>
        {assets.data?.assets.map((a) => (
          <p key={a.id} className="text-sm">
            {a.name} ({a.code}) · خرید {a.buyTomanPerGram?.toLocaleString('fa-IR')} · فروش{' '}
            {a.sellTomanPerGram?.toLocaleString('fa-IR')}
          </p>
        ))}
        <label className="block text-sm">
          کد عیار
          <input
            className={`${field} mt-2`}
            dir="ltr"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          نام
          <input
            className={`${field} mt-2`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          عیار
          <input
            className={`${field} mt-2`}
            value={purity}
            onChange={(e) => setPurity(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          قیمت خرید هر گرم (تومان)
          <input
            className={`${field} mt-2`}
            dir="ltr"
            inputMode="numeric"
            value={buy}
            onChange={(e) => setBuy(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          قیمت فروش هر گرم (تومان)
          <input
            className={`${field} mt-2`}
            dir="ltr"
            inputMode="numeric"
            value={sell}
            onChange={(e) => setSell(e.target.value)}
          />
        </label>
        {update.error && <Failure error={update.error} />}
        <Button
          disabled={
            !assets.data?.isDemo ||
            !code ||
            !name ||
            !purity ||
            !Number(buy) ||
            !Number(sell) ||
            update.isPending
          }
          onClick={() => update.mutate()}
        >
          ذخیره عیار و قیمت
        </Button>
      </section>
      <section className={`${panel} space-y-3`}>
        <h2 className="font-semibold">بررسی سفارش‌ها</h2>
        <label className="block text-sm">
          علت رد (برای رد الزامی)
          <input
            className={`${field} mt-2`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {decision.error && <Failure error={decision.error} />}
        {orders.isPending ? (
          <p role="status">در حال دریافت…</p>
        ) : orders.error ? (
          <Failure error={orders.error} retry={() => void orders.refetch()} />
        ) : (
          orders.data?.map((o) => (
            <article key={o.id} className="rounded-xl border border-[var(--border)] p-3 space-y-2">
              <p>
                {o.side === 'buy' ? 'خرید' : 'فروش'} {grams(o.quantityMg)} {o.assetCode} ·{' '}
                {amount(o.totalToman)} تومان · {state[o.state] ?? o.state}
              </p>
              {o.receipts?.map((r) => (
                <a
                  key={r.id}
                  href={`${api.defaults.baseURL}/platform/receipts/${r.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-[var(--teal-700)]"
                >
                  مشاهده رسید {new Date(r.createdAt).toLocaleString('fa-IR')} · {r.state}
                </a>
              ))}
              {o.payments
                ?.filter((p) => p.method === 'bank_transfer' && p.state === 'review')
                .map((p) => (
                  <div key={p.id} className="flex gap-2">
                    <Button
                      disabled={decision.isPending}
                      onClick={() =>
                        decision.mutate({ type: 'payment', id: p.id, value: 'approve' })
                      }
                    >
                      تأیید رسید
                    </Button>
                    <Button
                      variant="outline"
                      disabled={decision.isPending || reason.trim().length < 3}
                      onClick={() =>
                        decision.mutate({ type: 'payment', id: p.id, value: 'reject' })
                      }
                    >
                      رد رسید
                    </Button>
                  </div>
                ))}
              {o.state === 'admin_review' && (
                <div className="flex gap-2">
                  <Button
                    disabled={decision.isPending}
                    onClick={() => decision.mutate({ type: 'order', id: o.id, value: 'approve' })}
                  >
                    تأیید و تسویه
                  </Button>
                  <Button
                    variant="outline"
                    disabled={decision.isPending || reason.trim().length < 3}
                    onClick={() => decision.mutate({ type: 'order', id: o.id, value: 'reject' })}
                  >
                    رد سفارش
                  </Button>
                </div>
              )}
            </article>
          ))
        )}
      </section>
      <section className={`${panel} space-y-3`}>
        <h2 className="font-semibold">درخواست‌های برداشت</h2>
        <label className="block text-sm">
          شماره پیگیری واریز (برای تأیید)
          <input
            className={`${field} mt-2`}
            value={payoutReference}
            onChange={(e) => setPayoutReference(e.target.value)}
          />
        </label>
        {withdrawals.isPending ? (
          <p role="status">در حال دریافت…</p>
        ) : withdrawals.error ? (
          <Failure error={withdrawals.error} retry={() => void withdrawals.refetch()} />
        ) : (
          withdrawals.data?.map((w) => (
            <article key={w.id} className="rounded-xl border border-[var(--border)] p-3 space-y-2">
              <p>
                {amount(w.amountToman)} تومان · {w.holderName} · <span dir="ltr">{w.iban}</span> ·{' '}
                {w.state}
              </p>
              {w.state === 'pending' && (
                <div className="flex gap-2">
                  <Button
                    disabled={decision.isPending || payoutReference.trim().length < 3}
                    onClick={() =>
                      decision.mutate({ type: 'withdrawal', id: w.id, value: 'approve' })
                    }
                  >
                    تأیید برداشت
                  </Button>
                  <Button
                    variant="outline"
                    disabled={decision.isPending || reason.trim().length < 3}
                    onClick={() =>
                      decision.mutate({ type: 'withdrawal', id: w.id, value: 'reject' })
                    }
                  >
                    رد برداشت
                  </Button>
                </div>
              )}
            </article>
          ))
        )}
      </section>
    </>
  );
}
