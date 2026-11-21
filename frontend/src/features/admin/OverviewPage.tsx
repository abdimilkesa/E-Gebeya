import { FolderTree, Package, Plus, Store, Users, UsersRound } from 'lucide-react';
import { Link } from 'react-router';
import { StatusBadge } from '../../components/ui/Badge';
import { ButtonLink } from '../../components/ui/Button';
import { Card, CardHeader, StatCard } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui/States';
import { formatDate } from '../../lib/format';
import { useAdminOverview } from './queries';

export function OverviewPage() {
  const overviewQuery = useAdminOverview();

  return (
    <div>
      <PageHeader
        title="Overview"
        description="The marketplace at a glance."
        actions={
          <>
            <ButtonLink to="/admin/merchants?new=1" variant="secondary" icon={<Plus className="size-4" />}>
              New merchant
            </ButtonLink>
            <ButtonLink to="/admin/shops/new" icon={<Plus className="size-4" />}>
              New shop
            </ButtonLink>
          </>
        }
      />
      {overviewQuery.isPending ? (
        <LoadingState />
      ) : overviewQuery.isError ? (
        <ErrorState error={overviewQuery.error} onRetry={() => void overviewQuery.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Active shops"
              value={overviewQuery.data.shops.active}
              hint={`${overviewQuery.data.shops.total} total · ${overviewQuery.data.shops.suspended} suspended`}
              icon={<Store className="size-4" />}
              tone="accent"
            />
            <StatCard
              label="Merchants"
              value={overviewQuery.data.merchants.total}
              hint={
                overviewQuery.data.merchants.pendingPasswordChange > 0
                  ? `${overviewQuery.data.merchants.pendingPasswordChange} not signed in yet`
                  : `${overviewQuery.data.merchants.suspended} suspended`
              }
              icon={<UsersRound className="size-4" />}
            />
            <StatCard
              label="Customers"
              value={overviewQuery.data.customers.total}
              hint={`${overviewQuery.data.customers.suspended} suspended`}
              icon={<Users className="size-4" />}
            />
            <StatCard
              label="Active products"
              value={overviewQuery.data.products.active}
              hint={`${overviewQuery.data.products.outOfStock} out of stock`}
              icon={<Package className="size-4" />}
              tone={overviewQuery.data.products.outOfStock > 0 ? 'warning' : 'default'}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader
                title="Recently added shops"
                action={
                  <Link to="/admin/shops" className="text-sm font-medium text-ink-700 hover:text-ink-950">
                    View all
                  </Link>
                }
              />
              {overviewQuery.data.recentShops.length === 0 ? (
                <EmptyState
                  icon={<Store className="size-6" />}
                  title="No shops yet"
                  description="Create a merchant account, then register their shop with its exact location."
                  action={<ButtonLink to="/admin/shops/new">Create the first shop</ButtonLink>}
                />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {overviewQuery.data.recentShops.map((shop) => (
                    <li key={shop.id}>
                      <Link to={`/admin/shops/${shop.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-ink-50">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-900">{shop.name}</p>
                          <p className="text-sm text-ink-500">
                            @{shop.merchantUsername} · added {formatDate(shop.createdAt)}
                          </p>
                        </div>
                        <StatusBadge status={shop.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="Catalog" />
              <dl className="divide-y divide-ink-100 px-5 text-sm">
                {[
                  ['Products', overviewQuery.data.products.total],
                  ['Archived products', overviewQuery.data.products.archived],
                  ['Categories', overviewQuery.data.categories.total],
                  ['Active categories', overviewQuery.data.categories.active],
                  ['Removed shops', overviewQuery.data.shops.removed],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-3">
                    <dt className="text-ink-600">{label}</dt>
                    <dd className="font-semibold text-ink-950">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="border-t border-ink-100 p-4">
                <ButtonLink to="/admin/categories" variant="secondary" size="sm" icon={<FolderTree className="size-4" />}>
                  Manage categories
                </ButtonLink>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
