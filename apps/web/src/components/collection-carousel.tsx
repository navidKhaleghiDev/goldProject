import { Gem, Gift, HandCoins, Heart, Sparkles } from 'lucide-react';
import Link from 'next/link';

const categories = [
  { label: 'انگشتر', icon: Gem, tone: 'bg-[#f4e4d7] text-[#9c563c]' },
  { label: 'گردنبند', icon: Sparkles, tone: 'bg-[#dcefeb] text-[var(--teal-700)]' },
  { label: 'دستبند', icon: HandCoins, tone: 'bg-[#e6e1ef] text-[#765887]' },
  { label: 'گوشواره', icon: Heart, tone: 'bg-[#e9edf5] text-[#52698a]' },
  { label: 'هدیه', icon: Gift, tone: 'bg-[#f4e9c9] text-[#9b7422]' },
];

export function CollectionCarousel() {
  return (
    <section className="px-4 pt-7" aria-labelledby="collections-title">
      <div className="flex items-center justify-between">
        <h2 id="collections-title" className="text-base font-semibold">
          دسته‌بندی طلا
        </h2>
        <Link href="/categories" className="text-xs text-[var(--teal-700)]">
          مشاهده همه
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {categories.map(({ label, icon: Icon, tone }) => (
          <Link key={label} href="/products" className="group text-center">
            <span
              className={`mx-auto grid aspect-square w-full place-items-center rounded-xl ${tone} transition-transform group-hover:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-[var(--teal-700)]`}
            >
              <Icon aria-hidden="true" size={25} strokeWidth={1.7} />
            </span>
            <span className="mt-2 block text-[10px] font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
