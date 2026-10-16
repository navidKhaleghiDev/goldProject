import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from '@/components/providers';

const kalameh = localFont({
  src: [
    { path: './fonts/KalamehWeb-Regular.woff', weight: '400', style: 'normal' },
    { path: './fonts/KalamehWeb-SemiBold.woff', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  fallback: ['Tahoma', 'Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  appleWebApp: { capable: true, statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  title: 'خرید و فروش طلای آب‌شده',
  description: 'خرید، نگهداری و فروش طلای آب‌شده در نت گلد',
};

export const viewport: Viewport = {
  themeColor: '#F7F4ED',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body className={kalameh.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
