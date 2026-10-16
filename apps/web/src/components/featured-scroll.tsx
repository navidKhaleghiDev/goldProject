import Image from 'next/image';
import Link from 'next/link';

const cards = [
  {
    image: '/sections/gold-rings.jpeg',
    title: 'طلای خودت را بساز',
    description: 'ایده شما، طراحی و ساخت اختصاصی شری گلد',
    href: '/requests',
  },
  {
    image: '/sections/gold-earring.jpeg',
    title: 'زیورآلات آماده',
    description: 'برای هدیه و لحظه‌های خاص',
    href: '/products',
  },
  {
    image: '/hero/gold-bars.png',
    title: 'طلای آب‌شده',
    description: 'انتخاب شفاف و سرمایه‌ای',
    href: '/products',
  },
];

export function FeaturedScroll() {
  return (
    <section className="pt-7 pb-28" aria-labelledby="featured-scroll-title">
      <div className="flex items-center justify-between px-4">
        <h2 id="featured-scroll-title" className="text-base font-semibold">
          پیشنهادهای شری گلد
        </h2>
        <Link href="/products" className="text-xs text-[var(--teal-700)]">
          مشاهده همه
        </Link>
      </div>
      <div
        className="no-scrollbar mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2"
        dir="rtl"
      >
        {cards.map((card) => (
          <article
            key={card.title}
            className="relative min-h-52 w-[78%] shrink-0 snap-start overflow-hidden rounded-xl bg-[var(--teal-950)] shadow-[0_8px_24px_rgba(3,39,36,.12)]"
          >
            <Image
              src={card.image}
              alt={card.title}
              fill
              sizes="(max-width: 430px) 78vw, 335px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <h3 className="text-lg font-semibold">{card.title}</h3>
              <p className="mt-1 text-xs text-white/75">{card.description}</p>
              <Link
                href={card.href}
                className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-white px-3 text-xs font-semibold text-[var(--teal-950)]"
              >
                مشاهده
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
