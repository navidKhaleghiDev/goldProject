import type { ProductDto } from '@sheri-gold/contracts';

const categories = [
  ['انگشتر', 'rings'],
  ['گردنبند', 'necklaces'],
  ['دستبند', 'bracelets'],
  ['گوشواره', 'earrings'],
  ['طلای آب‌شده', 'melted-gold'],
  ['شمش طلا', 'gold-bars'],
  ['سکه', 'coins'],
  ['آویز', 'pendants'],
  ['زنجیر', 'chains'],
  ['نیم‌ست', 'sets'],
] as const;

const adjectives = ['ظریف', 'مینیمال', 'کلاسیک', 'مدرن', 'درخشان'];

const imagesByCategory = {
  rings: ['/sections/gold-rings.jpeg', '/hero/gold-bracelet.png'],
  necklaces: ['/hero/gold-jewelry.png', '/sections/gold-bracelet-wrist.jpeg'],
  bracelets: ['/sections/gold-bracelet-wrist.jpeg', '/hero/gold-bracelet.png'],
  earrings: ['/sections/gold-earring.jpeg', '/hero/gold-jewelry.png'],
  'melted-gold': ['/hero/gold-bars.png'],
  'gold-bars': ['/hero/gold-bars.png'],
  coins: ['/hero/gold-bars.png'],
  pendants: ['/sections/gold-bracelet-wrist.jpeg', '/hero/gold-jewelry.png'],
  chains: ['/hero/gold-jewelry.png', '/sections/gold-rings.jpeg'],
  sets: ['/hero/gold-jewelry.png', '/sections/gold-earring.jpeg'],
} as const;

export const demoProducts: ProductDto[] = Array.from({ length: 30 }, (_, index) => {
  const category = categories[index % categories.length]!;
  const weight = Number((1.1 + (index % 9) * 0.45).toFixed(2));
  const name = `${category[0]} طلای ${adjectives[index % adjectives.length]}`;
  return {
    id: `demo-${index + 1}`,
    code: `SG-${String(index + 1).padStart(3, '0')}`,
    name,
    category: {
      id: `category-${category[1]}`,
      name: category[0],
      slug: category[1],
      parentId: null,
    },
    shortDescription: 'طراحی سبک و شیک برای استفاده روزمره',
    description: 'محصول نمایشی شری گلد با اطلاعات آزمایشی برای نسخه MVP.',
    priceToman: 8_900_000 + index * 1_175_000,
    weightGrams: weight,
    purity: '۱۸ عیار',
    availability: index % 7 === 6 ? 'unavailable' : 'available',
    images: imagesByCategory[category[1]].map((url, imageIndex) => ({
      id: `demo-${index + 1}-image-${imageIndex + 1}`,
      url,
      alt: `${name}، نمای ${imageIndex + 1}`,
      position: imageIndex,
    })),
    updatedAt: new Date('2026-08-04T12:00:00.000Z').toISOString(),
  };
});
