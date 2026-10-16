import { cn } from '@/lib/utils';

export function BrandMark({
  tone = 'light',
  animated = false,
  size = 'default',
  symbolOnly = false,
}: {
  tone?: 'dark' | 'light';
  animated?: boolean;
  size?: 'default' | 'large';
  symbolOnly?: boolean;
}) {
  return (
    <div
      className={cn('net-brand flex shrink-0 items-center gap-3', animated && 'net-brand-enter')}
    >
      <svg
        className={cn('net-brand-symbol shrink-0', size === 'large' ? 'size-16' : 'size-9')}
        viewBox="0 0 40 40"
        fill="none"
        role="img"
        aria-label="نشان انتزاعی نت گلد"
      >
        <path d="M5 5h12v12H5zM23 5h12v12H23zM5 23h12v12H5zM23 23h12v12H23z" fill="currentColor" />
        <path d="M17 17h6v6h-6z" fill="var(--ivory)" />
      </svg>
      {!symbolOnly && (
        <span
          className={cn(
            'net-brand-wordmark whitespace-nowrap',
            size === 'large'
              ? 'net-brand-wordmark-large text-[30px] font-bold'
              : 'text-[17px] font-semibold tracking-[.13em]',
            tone === 'dark' ? 'text-white' : 'text-[var(--foreground)]'
          )}
          dir="ltr"
        >
          NETGOLD
        </span>
      )}
    </div>
  );
}
