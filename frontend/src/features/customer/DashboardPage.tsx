import type { PublicProduct } from '@marketplace/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { Card, CardHeader } from '../../components/ui/Card';
import { ErrorState, LoadingState, PageHeader } from '../../components/ui/States';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { AssistantWidget } from '../assistant/AssistantWidget';

export function ShopperDashboardPage() {
  const { user } = useAuth();
  const name = user?.fullName.split(' ')[0] ?? 'shopper';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${name}`}
        description="Prices below are read from the catalog now, including products a shop just posted. The analyst uses that same live list."
      />
      <LivePrices />
      <AssistantWidget embedded />
    </div>
  );
}

function LivePrices() {
  const prices = useQuery({
    queryKey: ['shopper-live-prices'],
    queryFn: () => api.page<PublicProduct>('/products', { pageSize: 50, sort: 'price_asc' }),
    refetchInterval: 15_000,
  });
  if (prices.isPending) return <LoadingState label="Reading current prices…" />;
  if (prices.isError) return <ErrorState error={prices.error} onRetry={() => void prices.refetch()} />;
  const readAt = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(prices.dataUpdatedAt);

  return (
    <Card>
      <CardHeader title="Prices right now" description={`Catalog read at ${readAt}. Refreshes every 15 seconds.`} />
      <ul className="divide-y divide-ink-100">
        {prices.data.items.map((product) => (
          <li key={product.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <div className="min-w-0">
              <Link to={`/products/${product.id}`} className="font-medium text-ink-950 hover:underline">
                {product.name}
              </Link>
              <p className="truncate text-xs text-ink-500">
                {product.shop.name} · {product.category.name}
                {product.canPurchase ? '' : ' · Unavailable'}
              </p>
            </div>
            <p className="shrink-0 font-semibold text-ink-950">{formatMoney(product.price)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
