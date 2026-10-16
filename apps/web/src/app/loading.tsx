import { BrandMark } from '@/components/brand-mark';

export default function Loading() {
  return <div className="fixed inset-y-0 left-1/2 z-[100] flex w-full max-w-[768px] -translate-x-1/2 items-center justify-center bg-[var(--ivory)]" role="status" aria-live="polite" aria-label="در حال بارگذاری صفحه">
    <div className="flex flex-col items-center gap-5"><BrandMark /><span className="h-[2px] w-12 animate-pulse bg-[var(--accent)]" aria-hidden="true" /></div>
  </div>;
}
