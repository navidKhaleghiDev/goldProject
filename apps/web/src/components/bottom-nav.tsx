'use client';

import { House, ArrowLeftRight, List, UserRound, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/trade/buy', label: 'معامله', icon: ArrowLeftRight },
  { href: '/activity', label: 'فعالیت', icon: List },
  { href: '/', label: 'خانه', icon: House },
  { href: '/products', label: 'محصولات', icon: ShoppingBag },
  { href: '/account', label: 'حساب', icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  if (pathname === '/login' || pathname === '/register') return null;
  return (
    <nav className="bottom-nav" aria-label="ناوبری اصلی">
      <div className="bottom-nav-items">
        {items.map((item) => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : item.href === '/trade/buy'
                ? pathname.startsWith('/trade')
                : item.href === '/products'
                  ? ['/products', '/cart', '/favorites'].some(
                      (path) => pathname === path || pathname.startsWith(`${path}/`)
                    )
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`bottom-nav-link${active ? ' bottom-nav-link-active' : ''}`}
            >
              <span className="bottom-nav-icon">
                <Icon size={20} strokeWidth={active ? 2.4 : 1.7} aria-hidden="true" />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
