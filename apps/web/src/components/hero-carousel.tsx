'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const slides = [
  {
    image: '/hero/ring-wave.jpg',
    alt: 'انگشتر طلای موجی روی دست',
    eyebrow: 'تازه رسیده',
    title: 'جزئیات کوچک، درخشش بزرگ',
    description: 'قطعه‌ای متفاوت برای استایل روزمره شما',
    href: '/products',
  },
  {
    image: '/hero/bracelet-sun.jpg',
    alt: 'دستبند طلای ظریف در نور آفتاب',
    eyebrow: 'انتخاب سردبیر',
    title: 'طلای روشن برای روزهای روشن',
    description: 'زیورآلاتی سبک با طراحی ماندگار',
    href: '/products',
  },
  {
    image: '/hero/ring-stack.jpg',
    alt: 'انگشترهای طلای ظریف روی دست',
    eyebrow: 'درخشش اصیل',
    title: 'ترکیب‌های ظریف و مدرن',
    description: 'انتخابی ماندگار برای لحظه‌های ارزشمند',
    href: '/products',
  },
  {
    image: '/hero/bracelet-editorial.jpeg',
    alt: 'دستبند طلای هندسی روی دست',
    eyebrow: 'طراحی برای شما',
    title: 'یک امضای طلایی برای استایل شما',
    description: 'جزئیاتی چشم‌نواز برای هر سلیقه',
    href: '/products',
  },
  {
    image: '/hero/gold-jewelry.png',
    alt: 'سرویس طلای ظریف روی پارچه مخمل سبز',
    eyebrow: 'درخشش اصیل',
    title: 'زیورآلات طلای شری گلد',
    description: 'انتخابی ماندگار برای لحظه‌های ارزشمند',
    href: '/products',
  },
  {
    image: '/hero/gold-bars.png',
    alt: 'شمش‌ها و سکه طلا روی سنگ سبز',
    eyebrow: 'سرمایه‌ای مطمئن',
    title: 'شمش و طلای سرمایه‌ای',
    description: 'محصولات منتخب با قیمت شفاف روز',
    href: '/products',
  },
  {
    image: '/hero/gold-bracelet.png',
    alt: 'دستبند و انگشتر طلا روی پارچه ابریشمی روشن',
    eyebrow: 'طراحی برای شما',
    title: 'طلای ظریف و مدرن',
    description: 'جزئیاتی چشم‌نواز برای استایل شخصی شما',
    href: '/products',
  },
] as const;

export function HeroCarousel() {
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef<HTMLElement | null>(null);
  const carouselVisibleRef = useRef(true);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const pauseTemporarily = () => {
    pausedRef.current = true;
    if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      pausedRef.current = false;
    }, 7000);
  };

  const goToSlide = (index: number) => {
    pauseTemporarily();
    setActiveSlide((index + slides.length) % slides.length);
  };

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        carouselVisibleRef.current = entry?.isIntersecting ?? false;
      },
      { threshold: 0.25 }
    );
    observer.observe(carousel);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = window.setInterval(() => {
      if (!carouselVisibleRef.current || document.hidden || pausedRef.current) return;
      setActiveSlide((currentSlide) => (currentSlide + 1) % slides.length);
    }, 4500);

    return () => {
      window.clearInterval(timer);
      if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
    };
  }, []);

  const slide = slides[activeSlide]!;

  return (
    <section
      ref={carouselRef}
      className="relative"
      aria-roledescription="carousel"
      aria-label="پیشنهادهای ویژه شری گلد"
      onTouchStart={(event) => {
        touchStartXRef.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const startX = touchStartXRef.current;
        const endX = event.changedTouches[0]?.clientX;
        touchStartXRef.current = null;
        if (startX === null || endX === undefined || Math.abs(endX - startX) < 45) return;
        goToSlide(activeSlide + (endX < startX ? 1 : -1));
      }}
      onFocusCapture={() => {
        pausedRef.current = true;
      }}
      onBlurCapture={() => {
        pausedRef.current = false;
      }}
      onPointerEnter={() => {
        pausedRef.current = true;
      }}
      onPointerLeave={() => {
        pausedRef.current = false;
      }}
    >
      <article
        key={slide.image}
        className="hero-slide-enter relative min-h-[310px] overflow-hidden bg-[var(--teal-950)]"
        aria-roledescription="slide"
        aria-label={`${activeSlide + 1} از ${slides.length}`}
      >
        <Image
          src={slide.image}
          alt={slide.alt}
          fill
          priority={activeSlide === 0}
          sizes="(max-width: 430px) 100vw, 430px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-start px-5 pb-7 text-right text-white">
          <span className="text-[10px] text-[var(--gold-300)]">{slide.eyebrow}</span>
          <h2 className="mt-1 text-xl font-semibold leading-8">{slide.title}</h2>
          <p className="mt-1 text-[11px] leading-5 text-white/75">{slide.description}</p>
          <Link
            href={slide.href}
            className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-[var(--gold-400)] px-3 text-xs font-semibold text-[var(--teal-950)] transition-colors hover:bg-[var(--gold-300)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            مشاهده محصولات
          </Link>
        </div>
      </article>

      <div
        className="absolute bottom-3.5 left-1/2 flex -translate-x-1/2 gap-1.5"
        aria-label="انتخاب اسلاید"
      >
        {slides.map((item, index) => (
          <button
            key={item.image}
            type="button"
            onClick={() => goToSlide(index)}
            aria-label={`نمایش اسلاید ${index + 1}`}
            aria-current={activeSlide === index ? 'true' : undefined}
            className={cn(
              'h-1.5 w-1.5 rounded-full bg-white/55 transition-all',
              activeSlide === index && 'w-4 bg-[var(--gold-300)]'
            )}
          />
        ))}
      </div>
    </section>
  );
}
