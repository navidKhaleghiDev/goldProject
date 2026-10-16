'use client';

import type { ProductDto } from '@sheri-gold/contracts';
import { ArrowLeft, Gem, Heart, PackageX, ShoppingBag } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { cn, formatToman } from '@/lib/utils';
import { useCartStore } from '@/stores/cart-store';
import { useFavoritesStore } from '@/stores/favorites-store';

export function ProductCard({
  product,
  featured = false,
}: {
  product: ProductDto;
  featured?: boolean;
}) {
  const favorite = useFavoritesStore((state) => state.productIds.includes(product.id));
  const toggleFavorite = useFavoritesStore((state) => state.toggle);
  const inCart = useCartStore((state) => state.productIds.includes(product.id));
  const addToCart = useCartStore((state) => state.add);
  const available = product.availability === 'available';
  const primaryImage = product.images[0];

  return (
    <article
      className={cn(
        'group relative isolate overflow-hidden rounded-xl bg-[var(--teal-950)] text-white shadow-[0_10px_30px_rgba(3,35,33,.14)]',
        featured ? 'min-h-[270px]' : 'min-h-[330px]'
      )}
    >
      {primaryImage ? (
        <Image
          src={primaryImage.url}
          alt={primaryImage.alt}
          fill
          sizes={featured ? '(max-width: 430px) 100vw, 430px' : '(max-width: 430px) 50vw, 215px'}
          className="object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-[var(--teal-900)] text-white/55">
          <Gem aria-hidden="true" size={featured ? 72 : 56} strokeWidth={1.1} />
        </div>
      )}

      <div
        className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/5"
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent"
        aria-hidden="true"
      />

      <button
        type="button"
        onClick={() => toggleFavorite(product.id)}
        className="absolute left-2.5 top-2.5 z-20 grid size-11 place-items-center rounded-full border border-white/25 bg-black/25 text-white backdrop-blur-md transition hover:bg-white hover:text-[var(--teal-900)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        aria-label={favorite ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
      >
        <Heart aria-hidden="true" size={19} fill={favorite ? 'currentColor' : 'none'} />
      </button>

      <div className="absolute right-2.5 top-2.5 z-20 rounded-full border border-white/20 bg-black/25 px-2.5 py-1 text-[10px] backdrop-blur-md">
        {available ? product.category.name : 'ناموجود'}
      </div>

      <div className={cn('absolute inset-x-0 bottom-0 z-10 flex flex-col p-3', featured && 'p-4')}>
        <Link
          href={`/products/${product.id}`}
          className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <h2
            className={cn(
              'line-clamp-2 font-semibold leading-6',
              featured ? 'text-xl' : 'text-[15px]'
            )}
          >
            {product.name}
          </h2>
        </Link>
        <p
          className={cn(
            'mt-1.5 line-clamp-2 text-white/75',
            featured ? 'text-sm leading-6' : 'text-[11px] leading-5'
          )}
        >
          {product.shortDescription}
        </p>
        <p className="mt-2 text-[11px] text-white/65">
          {product.purity}
          {product.weightGrams ? ` · ${product.weightGrams.toLocaleString('fa-IR')} گرم` : ''}
        </p>

        <div className="mt-3 flex items-end justify-between gap-2 border-t border-white/15 pt-3">
          <div className="min-w-0">
            <span className="block text-[9px] text-white/60">قیمت</span>
            <strong className={cn('block truncate', featured ? 'text-base' : 'text-xs')}>
              {formatToman(product.priceToman)}
            </strong>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              addToCart(product.id);
            }}
            disabled={false}
            className={cn(
              'inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-white/40 shadow-lg transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-65',
              inCart
                ? 'bg-[var(--gold-400)] text-[var(--teal-950)] hover:bg-[var(--gold-300)]'
                : 'bg-[var(--teal-700)] text-white hover:bg-[var(--teal-600)]'
            )}
            aria-label={
              available ? (inCart ? 'در سبد خرید' : 'افزودن به سبد خرید') : 'محصول ناموجود'
            }
          >
            {available ? (
              inCart ? (
                <ArrowLeft aria-hidden="true" size={19} />
              ) : (
                <ShoppingBag aria-hidden="true" size={19} />
              )
            ) : (
              <PackageX aria-hidden="true" size={19} />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
