'use client';

import Image from 'next/image';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { MobileShell } from '@/components/mobile-shell';
import { Button } from '@/components/ui/button';
import { demoProducts } from '@/lib/demo-products';
import { formatToman } from '@/lib/utils';
import { useCartStore } from '@/stores/cart-store';

export default function CartPage() {
  const productIds = useCartStore((state) => state.productIds);
  const remove = useCartStore((state) => state.remove);
  const products = demoProducts.filter((product) => productIds.includes(product.id));
  const total = products.reduce((sum, product) => sum + product.priceToman, 0);
  return (
    <MobileShell protectedPage>
      <main className="px-4 pb-28 pt-5">
        <h1 className="text-lg font-semibold">سبد خرید</h1>
        {products.length ? (
          <>
            <div className="mt-4 grid gap-3">
              {products.map((product) => (
                <article
                  key={product.id}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-3"
                >
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-[var(--teal-50)]">
                    {product.images[0] ? (
                      <Image
                        src={product.images[0].url}
                        alt={product.images[0].alt}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <ShoppingBag
                        className="absolute inset-0 m-auto text-[var(--gold-600)]"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold">{product.name}</h2>
                    <p className="mt-1 text-xs text-[var(--gold-800)]">
                      {formatToman(product.priceToman)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(product.id)}
                    className="grid size-10 place-items-center rounded-xl text-[var(--danger)]"
                    aria-label={`حذف ${product.name}`}
                  >
                    <Trash2 aria-hidden="true" size={18} />
                  </button>
                </article>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-[var(--teal-800)] p-4 text-white">
              <div className="flex justify-between">
                <span>مجموع سبد</span>
                <strong className="text-[var(--gold-300)]">{formatToman(total)}</strong>
              </div>
              <p className="mt-2 text-xs text-white/65">
                قیمت‌ها پیش از ثبت درخواست دوباره بررسی می‌شوند.
              </p>
              <Button className="mt-4 w-full" variant="gold">
                ثبت درخواست خرید
              </Button>
            </div>
          </>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-[var(--border)] bg-white p-8 text-center">
            <ShoppingBag className="mx-auto text-[var(--gold-600)]" aria-hidden="true" />
            <h2 className="mt-3 font-semibold">سبد خرید خالی است</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              محصولات دلخواهتان را به سبد اضافه کنید.
            </p>
          </div>
        )}
      </main>
    </MobileShell>
  );
}
