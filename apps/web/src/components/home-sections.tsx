import Image from 'next/image';
import Link from 'next/link';

const sections = [
  {
    image: '/sections/gold-bracelet-wrist.jpeg',
    alt: 'دستبند طلای ظریف روی مچ دست',
    title: 'زیورآلات آماده',
    description: 'برای هدیه و لحظه‌های خاص',
    action: 'مشاهده',
    href: '/products',
    tone: 'emerald',
    wide: false,
  },
  {
    image: '/hero/gold-bars.png',
    alt: 'شمش و طلای سرمایه‌ای روی سنگ سبز',
    title: 'طلای آب‌شده',
    description: 'انتخاب شفاف و سرمایه‌ای',
    action: 'مشاهده',
    href: '/products',
    tone: 'gray',
    wide: false,
  },
  {
    image: '/sections/gold-rings.jpeg',
    alt: 'مجموعه‌ای از انگشترهای طلای مدرن روی دست',
    title: 'طلای خودت را بساز',
    description: 'ایده شما، طراحی و ساخت اختصاصی شری گلد',
    action: 'ثبت درخواست ساخت',
    href: '/requests',
    tone: 'plum',
    wide: true,
  },
] as const;

const toneClasses = {
  emerald: 'from-[var(--teal-950)]/95 via-[var(--teal-800)]/55',
  gray: 'from-[#242625]/95 via-[#777a77]/45',
  plum: 'from-[#39213f]/95 via-[#68496b]/50',
} as const;

export function HomeSections() {
  return (
    <section className="px-4 pt-6" aria-labelledby="home-services-title">
      <div className="flex items-center justify-between">
        <h2 id="home-services-title" className="text-base font-semibold">
          پیشنهادهای شری گلد
        </h2>
        <Link href="/products" className="text-xs text-[var(--teal-700)]">
          مشاهده همه
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {sections.map((section) => (
          <HomeSection key={section.title} {...section} />
        ))}
      </div>
    </section>
  );
}

type HomeSectionProps = (typeof sections)[number];

function HomeSection({
  image,
  alt,
  title,
  description,
  action,
  href,
  tone,
  wide,
}: HomeSectionProps) {
  return (
    <article
      className={`relative overflow-hidden rounded-xl bg-[var(--teal-950)] shadow-[0_8px_24px_rgba(3,39,36,.1)] ${wide ? 'col-span-2 min-h-44' : 'min-h-52'}`}
    >
      <Image
        src={image}
        alt={alt}
        fill
        sizes={wide ? '(max-width: 430px) 100vw, 398px' : '(max-width: 430px) 50vw, 193px'}
        className={`object-cover ${wide ? 'object-left' : 'object-center'}`}
      />
      <div className={`absolute inset-0 bg-gradient-to-t ${toneClasses[tone]} to-transparent`} />
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-start p-4 text-right text-white">
        <h3 className="text-base font-semibold leading-6">{title}</h3>
        <p className="mt-1 text-[11px] leading-5 text-white/75">{description}</p>
        <Link
          href={href}
          className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-white px-3 text-[11px] font-semibold text-[var(--teal-950)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {action}
        </Link>
      </div>
    </article>
  );
}
