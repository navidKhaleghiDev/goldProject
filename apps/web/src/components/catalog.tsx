'use client';

import { Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { demoProducts } from '@/lib/demo-products';
import { ProductCard } from './product-card';

const all = 'همه';
const categories = [
  all,
  ...Array.from(new Set(demoProducts.map((product) => product.category.name))),
];

export function Catalog() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(all);
  const [draftCategory, setDraftCategory] = useState(all);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [draftMinPrice, setDraftMinPrice] = useState('');
  const [draftMaxPrice, setDraftMaxPrice] = useState('');
  const [minWeight, setMinWeight] = useState('');
  const [maxWeight, setMaxWeight] = useState('');
  const [draftMinWeight, setDraftMinWeight] = useState('');
  const [draftMaxWeight, setDraftMaxWeight] = useState('');
  const [sort, setSort] = useState<'asc' | 'desc'>('asc');
  const filterDialogRef = useRef<HTMLDialogElement | null>(null);
  const activeFilterCount =
    Number(category !== all) +
    Number(Boolean(minPrice || maxPrice)) +
    Number(Boolean(minWeight || maxWeight));

  const products = useMemo(
    () =>
      demoProducts
        .filter((product) => {
          const price = product.priceToman;
          const weight = product.weightGrams ?? 0;
          return (
            (!query ||
              product.name.includes(query) ||
              product.code.toLowerCase().includes(query.toLowerCase())) &&
            (category === all || product.category.name === category) &&
            (!minPrice || price >= Number(minPrice)) &&
            (!maxPrice || price <= Number(maxPrice)) &&
            (!minWeight || weight >= Number(minWeight)) &&
            (!maxWeight || weight <= Number(maxWeight))
          );
        })
        .sort((a, b) =>
          sort === 'asc' ? a.priceToman - b.priceToman : b.priceToman - a.priceToman
        ),
    [query, category, minPrice, maxPrice, minWeight, maxWeight, sort]
  );

  const openFilters = () => {
    setDraftCategory(category);
    setDraftMinPrice(minPrice);
    setDraftMaxPrice(maxPrice);
    setDraftMinWeight(minWeight);
    setDraftMaxWeight(maxWeight);
    filterDialogRef.current?.showModal();
  };
  const clearFilters = () => {
    setCategory(all);
    setDraftCategory(all);
    setMinPrice('');
    setMaxPrice('');
    setDraftMinPrice('');
    setDraftMaxPrice('');
    setMinWeight('');
    setMaxWeight('');
    setDraftMinWeight('');
    setDraftMaxWeight('');
  };

  return (
    <main className="px-4 pb-28 pt-4">
      <div className='flex items-center justify-between'>
      <label className="relative block">
        <span className="sr-only">جستجو در محصولات</span>
        <Search
          className="absolute right-3 top-3.5 text-[var(--muted)]"
          aria-hidden="true"
          size={19}
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          type="search"
          placeholder="جستجو در محصولات شری گلد"
          className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white pr-10 pl-3 text-sm outline-none focus:border-[var(--teal-600)] focus:ring-2 focus:ring-[var(--teal-100)]"
        />
      </label>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={openFilters}
          className="relative grid size-11 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--teal-800)]"
          aria-label="باز کردن فیلترها"
          aria-haspopup="dialog"
        >
          <Filter aria-hidden="true" size={18} />
          {activeFilterCount > 0 ? (
            <span className="absolute -left-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-[var(--teal-700)] px-1 text-[10px] leading-5 text-white">
              {activeFilterCount.toLocaleString('fa-IR')}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setSort((value) => (value === 'asc' ? 'desc' : 'asc'))}
          className="grid size-11 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--teal-800)]"
          aria-label="تغییر مرتب‌سازی"
        >
          <SlidersHorizontal aria-hidden="true" size={18} />
        </button>
      </div>
      </div>


      <dialog
        ref={filterDialogRef}
        className="fixed inset-x-0 bottom-0 top-auto m-0 mx-auto w-full max-w-[768px] rounded-t-md border-0 bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-2xl backdrop:bg-black/45"
        aria-labelledby="filter-title"
      >
        <div className="flex max-h-[82dvh] flex-col">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h2 id="filter-title" className="font-semibold">
              فیلتر محصولات
            </h2>
            <form method="dialog">
              <button
                type="submit"
                className="grid size-11 place-items-center text-[var(--muted)]"
                aria-label="بستن فیلترها"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </form>
          </div>
          <div className="overflow-y-auto px-4 py-4">
            <fieldset>
              <legend className="text-sm font-semibold">دسته‌بندی</legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {categories.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setDraftCategory(name)}
                    aria-pressed={draftCategory === name}
                    className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-sm aria-pressed:border-[var(--teal-700)] aria-pressed:bg-[var(--teal-50)]"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </fieldset>
            <FilterRange
              label="بازه قیمت (تومان)"
              min={draftMinPrice}
              max={draftMaxPrice}
              setMin={setDraftMinPrice}
              setMax={setDraftMaxPrice}
            />
            <FilterRange
              label="بازه وزن (گرم)"
              min={draftMinWeight}
              max={draftMaxWeight}
              setMin={setDraftMinWeight}
              setMax={setDraftMaxWeight}
            />
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-2 border-t border-[var(--border)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <button
              type="button"
              onClick={clearFilters}
              disabled={activeFilterCount === 0}
              className="min-h-11 rounded-lg border border-[var(--border)] px-4 text-sm text-[var(--muted)] disabled:opacity-40"
            >
              حذف فیلتر
            </button>
            <form method="dialog">
              <button
                type="submit"
                onClick={() => {
                  setCategory(draftCategory);
                  setMinPrice(draftMinPrice);
                  setMaxPrice(draftMaxPrice);
                  setMinWeight(draftMinWeight);
                  setMaxWeight(draftMaxWeight);
                }}
                className="min-h-11 w-full rounded-lg bg-[var(--teal-700)] px-4 text-sm font-semibold text-white"
              >
                اعمال فیلتر
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {products.length ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {products.map((product, index) => (
            <div key={product.id} className={index % 5 === 0 ? 'col-span-2' : undefined}>
              <ProductCard product={product} featured={index % 5 === 0} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--border)] bg-white p-8 text-center">
          <Search className="mx-auto text-[var(--muted)]" aria-hidden="true" />
          <h2 className="mt-3 font-semibold">محصولی پیدا نشد</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">عبارت جستجو یا فیلترها را تغییر دهید.</p>
        </div>
      )}
    </main>
  );
}

function FilterRange({
  label,
  min,
  max,
  setMin,
  setMax,
}: {
  label: string;
  min: string;
  max: string;
  setMin: (value: string) => void;
  setMax: (value: string) => void;
}) {
  return (
    <fieldset className="mt-5 border-t border-[var(--border)] pt-4">
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <input
          inputMode="numeric"
          value={min}
          onChange={(event) => setMin(event.target.value.replace(/\D/g, ''))}
          placeholder="از"
          aria-label={`${label} حداقل`}
          className="h-11 rounded-lg border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--teal-600)]"
        />
        <input
          inputMode="numeric"
          value={max}
          onChange={(event) => setMax(event.target.value.replace(/\D/g, ''))}
          placeholder="تا"
          aria-label={`${label} حداکثر`}
          className="h-11 rounded-lg border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--teal-600)]"
        />
      </div>
    </fieldset>
  );
}
