'use client';

import { Heart } from 'lucide-react';
import { MobileShell } from '@/components/mobile-shell';
import { ProductCard } from '@/components/product-card';
import { demoProducts } from '@/lib/demo-products';
import { useFavoritesStore } from '@/stores/favorites-store';

export default function FavoritesPage() {
  const productIds = useFavoritesStore((state) => state.productIds);
  const products = demoProducts.filter((product) => productIds.includes(product.id));
  return (
    <MobileShell protectedPage>
      <main className="px-4 pb-28 pt-5">
        <h1 className="text-lg font-semibold">علاقه‌مندی‌ها</h1>
        {products.length ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-[var(--border)] bg-white p-8 text-center">
            <Heart className="mx-auto text-[var(--gold-600)]" aria-hidden="true" />
            <h2 className="mt-3 font-semibold">فهرست شما خالی است</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              با لمس قلب، محصولات را برای بعد نگه دارید.
            </p>
          </div>
        )}
      </main>
    </MobileShell>
  );
}
