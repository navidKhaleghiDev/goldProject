import { notFound } from 'next/navigation';
import { MobileShell } from '@/components/mobile-shell';
import { ProductDetails } from '@/components/product-details';
import { demoProducts } from '@/lib/demo-products';

export function generateStaticParams() {
  return demoProducts.map((product) => ({ id: product.id }));
}

export default async function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = demoProducts.find((item) => item.id === id);

  if (!product) notFound();

  return (
    <MobileShell>
      <ProductDetails product={product} />
    </MobileShell>
  );
}
