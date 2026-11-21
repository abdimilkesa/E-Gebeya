import { SHOP_STATUSES, type ShopStatus } from '@marketplace/contracts';
import { MapPin, Plus, Store } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { StatusBadge } from '../../components/ui/Badge';
import { ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Form';
import { Pagination } from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/SearchInput';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui/States';
import { Table, Td, Th } from '../../components/ui/Table';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { useAdminShops } from './queries';

export function ShopsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ShopStatus | ''>('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());
  const shopsQuery = useAdminShops({ q: q || undefined, status: status || undefined, page, pageSize: 20 });

  return (
    <div>
      <PageHeader
        title="Shops"
        description="Every shop on the marketplace, including hidden ones."
        actions={
          <ButtonLink to="/admin/shops/new" icon={<Plus className="size-4" />}>
            New shop
          </ButtonLink>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search by shop name"
            className="flex-1"
          />
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as ShopStatus | '');
              setPage(1);
            }}
            aria-label="Filter by status"
            className="sm:w-44"
          >
            <option value="">All statuses</option>
            {SHOP_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.charAt(0) + value.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
        {shopsQuery.isPending ? (
          <LoadingState />
        ) : shopsQuery.isError ? (
          <ErrorState error={shopsQuery.error} onRetry={() => void shopsQuery.refetch()} />
        ) : shopsQuery.data.items.length === 0 ? (
          <EmptyState
            icon={<Store className="size-6" />}
            title={q || status ? 'No shops match' : 'No shops yet'}
            description={q || status ? 'Try a different search or status.' : 'Register the first shop to put it on the map.'}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Shop</Th>
                  <Th>Merchant</Th>
                  <Th>Location</Th>
                  <Th className="text-right">Products</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {shopsQuery.data.items.map((shop) => (
                  <tr
                    key={shop.id}
                    className="cursor-pointer hover:bg-ink-50"
                    onClick={() => navigate(`/admin/shops/${shop.id}`)}
                  >
                    <Td>
                      <Link to={`/admin/shops/${shop.id}`} className="font-medium text-ink-950 hover:underline" onClick={(event) => event.stopPropagation()}>
                        {shop.name}
                      </Link>
                      <p className="text-xs text-ink-500">{shop.addressText}</p>
                    </Td>
                    <Td>
                      <p className="text-ink-900">{shop.merchant.fullName}</p>
                      <p className="text-xs text-ink-500">
                        @{shop.merchant.username}
                        {shop.merchant.status === 'SUSPENDED' ? ' · suspended' : ''}
                      </p>
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-600">
                        <MapPin className="size-3.5" />
                        {shop.latitude}, {shop.longitude}
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums">{shop.productCount}</Td>
                    <Td>
                      <StatusBadge status={shop.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="px-4">
              <Pagination meta={shopsQuery.data.meta} onPageChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
