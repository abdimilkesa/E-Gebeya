import type { MerchantProduct, PublicProduct } from '@marketplace/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader } from '../../components/ui/Card';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { compareWithMarket, type MarketComparison } from './market-position';

const POSITION_LABEL: Record<MarketComparison['position'], string> = {
  only: 'Only seller',
  'one-other': 'One other price',
  below: 'Below other shops',
  same: 'At the average',
  above: 'Above other shops',
};

const POSITION_TONE: Record<MarketComparison['position'], 'neutral' | 'success' | 'info' | 'warning'> = {
  only: 'neutral',
  'one-other': 'neutral',
  below: 'success',
  same: 'info',
  above: 'warning',
};

function positionDetail(row: MarketComparison): string {
  if (row.position === 'only') return `No other shop has a buyable product in ${row.categoryName} right now.`;
  if (row.position === 'one-other') return 'One other buyable price, so there is no average.';
  return `${row.position === 'below' ? 'Below' : row.position === 'above' ? 'Above' : 'Same as'} the average of other shops' buyable prices (${formatMoney(row.averageOther ?? '0')}).`;
}

export function MarketPosition({ shopIds }: { shopIds: string[] }) {
  const own = useQuery({
    queryKey: ['merchant', 'market-own'],
    queryFn: () => api.page<MerchantProduct>('/merchant/products', { pageSize: 50, status: 'ACTIVE' }),
    refetchInterval: 15_000,
  });
  const catalog = useQuery({
    queryKey: ['merchant', 'market-catalog'],
    queryFn: () => api.page<PublicProduct>('/products', { pageSize: 50, sort: 'price_asc' }),
    refetchInterval: 15_000,
  });

  if (own.isPending || catalog.isPending) return <LoadingState label="Reading current prices…" />;
  if (own.isError) return <ErrorState error={own.error} onRetry={() => void own.refetch()} />;
  if (catalog.isError) return <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />;

  const readAt = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(Math.min(own.dataUpdatedAt, catalog.dataUpdatedAt));
  const rows = compareWithMarket(
    own.data.items.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      categorySlug: product.category.slug,
      categoryName: product.category.name,
    })),
    catalog.data.items.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      canPurchase: product.canPurchase,
      categorySlug: product.category.slug,
      shopId: product.shop.id,
      shopName: product.shop.name,
    })),
    shopIds,
  );

  return (
    <Card>
      <CardHeader
        title="Your prices against the market"
        description={`Catalog read at ${readAt}. Refreshes every 15 seconds. Compared with other shops in the same category.`}
      />
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-500">Add an active product to compare its price with other shops.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {rows.map((row) => (
            <li key={row.productId} className="space-y-2 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/merchant/products/${row.productId}`} className="font-medium text-ink-950 hover:underline">
                    {row.name}
                  </Link>
                  <p className="text-xs text-ink-500">{row.categoryName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={POSITION_TONE[row.position]}>{POSITION_LABEL[row.position]}</Badge>
                  <span className="text-sm font-semibold text-ink-950">{formatMoney(row.price)}</span>
                </div>
              </div>
              <p className="text-sm text-ink-600">{positionDetail(row)}</p>
              {row.onTheMarket ? (
                row.shoppersCanBuy ? null : (
                  <p className="text-sm text-amber-800">Listed, but shoppers cannot buy it right now.</p>
                )
              ) : (
                <p className="text-sm text-amber-800">Shoppers cannot see this product yet.</p>
              )}
              {row.others.length > 0 ? (
                <ul className="space-y-1 text-sm text-ink-600">
                  {row.others.map((other) => (
                    <li key={`${other.shopName}-${other.name}`}>
                      {other.name} · {other.shopName} · {formatMoney(other.price)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
