'use client';

import type { ProductDto } from '@sheri-gold/contracts';
import { ArrowRight, Gem, Heart, PackageX, ShoppingBag } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { cn, formatToman } from '@/lib/utils';
import { useCartStore } from '@/stores/cart-store';
import { useFavoritesStore } from '@/stores/favorites-store';
import { Button } from './ui/button';

export function ProductDetails({ product }: { product: ProductDto }) {
  const [activeImage, setActiveImage] = useState(0);
  const favorite = useFavoritesStore((state) => state.productIds.includes(product.id));
  const toggleFavorite = useFavoritesStore((state) => state.toggle);
  const inCart = useCartStore((state) => state.productIds.includes(product.id));
  const addToCart = useCartStore((state) => state.add);
  const available = product.availability === 'available';
  const image = product.images[activeImage];

  return (
    <main className="pb-32">
      <section className="relative aspect-[4/5] overflow-hidden bg-[var(--teal-900)]">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt}
            fill
            priority
            sizes="(max-width: 430px) 100vw, 430px"
            className="object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center text-white/50">
            <Gem size={80} strokeWidth={1} />
          </div>
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/25"
          aria-hidden="true"
        />
        <Link
          href="/products"
          className="absolute right-3 top-3 grid size-11 place-items-center rounded-full border border-white/25 bg-black/25 text-white backdrop-blur-md"
          aria-label="بازگشت به محصولات"
        >
          <ArrowRight aria-hidden="true" size={20} />
        </Link>
        <button
          type="button"
          onClick={() => toggleFavorite(product.id)}
          className="absolute left-3 top-3 grid size-11 place-items-center rounded-full border border-white/25 bg-black/25 text-white backdrop-blur-md"
          aria-label={favorite ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
        >
          <Heart aria-hidden="true" size={20} fill={favorite ? 'currentColor' : 'none'} />
        </button>
        <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 text-white">
          <div>
            <span className="text-xs text-white/70">{product.category.name}</span>
            <h1 className="mt-1 text-2xl font-semibold">{product.name}</h1>
          </div>
          <span className="shrink-0 rounded-full border border-white/20 bg-black/25 px-3 py-1.5 text-xs backdrop-blur-md">
            {available ? 'موجود' : 'ناموجود'}
          </span>
        </div>
      </section>

      {product.images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto px-4 py-3" aria-label="تصاویر محصول">
          {product.images.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveImage(index)}
              className={cn(
                'relative size-16 shrink-0 overflow-hidden rounded-lg border-2',
                activeImage === index ? 'border-[var(--teal-700)]' : 'border-transparent'
              )}
              aria-label={`نمایش تصویر ${index + 1}`}
            >
              <Image src={item.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      <section className="px-4 pt-4">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <span className="text-xs text-[var(--muted)]">قیمت نهایی</span>
            <strong className="mt-1 block text-xl text-[var(--teal-900)]">
              {formatToman(product.priceToman)}
            </strong>
          </div>
          <div className="text-left text-xs leading-6 text-[var(--muted)]">
            <p>{product.purity}</p>
            {product.weightGrams ? <p>{product.weightGrams.toLocaleString('fa-IR')} گرم</p> : null}
          </div>
        </div>
        <div className="py-5">
          <h2 className="text-base font-semibold">درباره محصول</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{product.description}</p>
        </div>
        <Button
          className="w-full"
          variant={inCart ? 'outline' : 'primary'}
          disabled={!available || inCart}
          onClick={() => available && addToCart(product.id)}
        >
          {available ? (
            <ShoppingBag aria-hidden="true" size={18} />
          ) : (
            <PackageX aria-hidden="true" size={18} />
          )}
          {available
            ? inCart
              ? 'در سبد خرید شماست'
              : 'افزودن به سبد خرید'
            : 'این محصول فعلاً موجود نیست'}
        </Button>
      </section>
    </main>
  );
}
