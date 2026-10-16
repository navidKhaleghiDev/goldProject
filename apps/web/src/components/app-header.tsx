'use client';

import { History, ShoppingBag, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GoldPriceTicker } from './gold-price-ticker';
import { useCartStore } from '@/stores/cart-store';

export function AppHeader() {
  const pathname = usePathname();
  const cartCount = useCartStore((state) => state.productIds.length);
  const showCart = ['/products', '/cart', '/favorites'].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  return (
    <div className="app-header">
      <header className="app-header-main">
        <Link
          href="/activity"
          className="app-header-history"
          aria-label="آخرین تراکنش‌ها"
          aria-current={pathname === '/activity' ? 'page' : undefined}
        >
          <History size={22} strokeWidth={1.8} aria-hidden="true" />
        </Link>
        <div className="app-header-actions">
          {showCart ? (
            <Link
              href="/cart"
              className="app-header-cart"
              aria-label={`سبد خرید، ${cartCount.toLocaleString('fa-IR')} محصول`}
            >
              <ShoppingBag size={19} aria-hidden="true" />
              {cartCount > 0 ? (
                <span className="app-header-cart-count">{cartCount.toLocaleString('fa-IR')}</span>
              ) : null}
            </Link>
          ) : null}
          <Link
            href="/account"
            aria-label="حساب کاربری"
            className="app-header-profile"
          >
            <UserRound size={22} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        </div>
      </header>
      <GoldPriceTicker />
    </div>
  );
}
