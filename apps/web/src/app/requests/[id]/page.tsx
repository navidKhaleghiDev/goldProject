import { GoldTransactionDetail } from '@/components/gold-history';
export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GoldTransactionDetail id={id} />;
}
