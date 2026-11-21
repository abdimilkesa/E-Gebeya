import { LOW_STOCK_THRESHOLD } from '@marketplace/contracts';
import { AlertTriangle, Eye, EyeOff, Package, PackageX, Plus, TrendingDown } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { ButtonLink } from '../../components/ui/Button';
import { Card, CardHeader, StatCard } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui/States';
import { useAuth } from '../../auth/AuthProvider';
import { formatDate, formatMoney } from '../../lib/format';
import { MarketPosition } from './MarketPosition';
import { useMerchantDashboard } from './queries';

export function DashboardPage() {
  const { user } = useAuth();
  const dashboardQuery = useMerchantDashboard();

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.fullName.split(' ')[0] ?? 'merchant'}`}
        description="Your shop, your stock, and how your prices sit against other shops right now."
        actions={
          <ButtonLink to="/merchant/products/new" icon={<Plus className="size-4" />}>
            Add product
          </ButtonLink>
        }
      />
      {dashboardQuery.isPending ? (
        <LoadingState />
      ) : dashboardQuery.isError ? (
        <ErrorState error={dashboardQuery.error} onRetry={() => void dashboardQuery.refetch()} />
      ) : dashboardQuery.data.shops.length === 0 ? (
        <Card>
          <EmptyState
            title="No shop assigned yet"
            description="The marketplace administrator registers your shop and its location. You can add products as soon as it exists."
          />
        </Card>
      ) : (
        <>
          <div className="mb-6 space-y-2">
            {dashboardQuery.data.shops.map((shop) => (
              <Card key={shop.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-3">
                  {shop.isPublic ? (
                    <Eye className="size-5 text-emerald-600" />
                  ) : (
                    <EyeOff className="size-5 text-amber-600" />
                  )}
                  <div>
                    <p className="font-semibold text-ink-950">{shop.name}</p>
                    <p className="text-sm text-ink-500">
                      {shop.isPublic
                        ? 'Visible to customers on the map.'
                        : 'Hidden from customers. Contact the marketplace administrator.'}
                    </p>
                  </div>
                </div>
                {shop.isPublic ? (
                  <ButtonLink to={`/shops/${shop.slug}`} variant="secondary" size="sm" target="_blank">
                    View storefront
                  </ButtonLink>
                ) : (
                  <Badge tone="warning">Hidden</Badge>
                )}
              </Card>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Active products"
              value={dashboardQuery.data.products.active}
              hint={`${dashboardQuery.data.products.archived} archived`}
              icon={<Package className="size-4" />}
              tone="accent"
            />
            <StatCard
              label="Out of stock"
              value={dashboardQuery.data.products.outOfStock}
              icon={<PackageX className="size-4" />}
              tone={dashboardQuery.data.products.outOfStock > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Low stock"
              value={dashboardQuery.data.products.lowStock}
              hint={`${LOW_STOCK_THRESHOLD} or fewer left`}
              icon={<TrendingDown className="size-4" />}
              tone={dashboardQuery.data.products.lowStock > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Marked unavailable"
              value={dashboardQuery.data.products.unavailable}
              icon={<EyeOff className="size-4" />}
            />
          </div>

          <div className="mt-6">
            <MarketPosition shopIds={dashboardQuery.data.shops.map((shop) => shop.id)} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Needs restocking" description="Active products at or below the low-stock level." />
              {dashboardQuery.data.lowStockProducts.length === 0 ? (
                <EmptyState title="Stock looks healthy" description="Nothing is running low." />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {dashboardQuery.data.lowStockProducts.map((product) => (
                    <li key={product.id}>
                      <Link to={`/merchant/products/${product.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-ink-50">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-900">{product.name}</p>
                          <p className="text-xs text-ink-500">{product.shopName}</p>
                        </div>
                        <Badge tone={product.stockQuantity === 0 ? 'danger' : 'warning'}>
                          <AlertTriangle className="size-3" />
                          {product.stockQuantity === 0 ? 'Out of stock' : `${product.stockQuantity} left`}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader
                title="Recently updated"
                action={
                  <Link to="/merchant/products" className="text-sm font-medium text-ink-700 hover:text-ink-950">
                    All products
                  </Link>
                }
              />
              {dashboardQuery.data.recentProducts.length === 0 ? (
                <EmptyState
                  title="No products yet"
                  description="Add your first product so customers can find it."
                  action={<ButtonLink to="/merchant/products/new">Add product</ButtonLink>}
                />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {dashboardQuery.data.recentProducts.map((product) => (
                    <li key={product.id}>
                      <Link to={`/merchant/products/${product.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-ink-50">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-900">{product.name}</p>
                          <p className="text-xs text-ink-500">Updated {formatDate(product.updatedAt)}</p>
                        </div>
                        <span className="text-sm font-semibold text-ink-950">{formatMoney(product.price)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
