import { LOW_STOCK_THRESHOLD, type MerchantProduct } from '@marketplace/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Form';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { Pagination } from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/SearchInput';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui/States';
import { Table, Td, Th } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';
import { api, errorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { invalidateMerchantData, useMerchantProducts } from './queries';

export function StockBadge({ product }: { product: Pick<MerchantProduct, 'stockQuantity'> }) {
  if (product.stockQuantity === 0) return <Badge tone="danger">Out of stock</Badge>;
  if (product.stockQuantity <= LOW_STOCK_THRESHOLD) return <Badge tone="warning">{product.stockQuantity} left</Badge>;
  return <span className="tabular-nums text-ink-700">{product.stockQuantity}</span>;
}

export function ProductsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'ARCHIVED' | ''>('ACTIVE');
  const [stock, setStock] = useState<'in_stock' | 'out_of_stock' | ''>('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());
  const productsQuery = useMerchantProducts({
    q: q || undefined,
    status: status || undefined,
    stock: stock || undefined,
    page,
    pageSize: 20,
  });

  const archive = useMutation({
    mutationFn: (product: MerchantProduct) =>
      product.status === 'ACTIVE'
        ? api.delete<MerchantProduct>(`/merchant/products/${product.id}`)
        : api.post<MerchantProduct>(`/merchant/products/${product.id}/restore`),
    onSuccess: (updated) => {
      toast.success(updated.status === 'ARCHIVED' ? `${updated.name} archived` : `${updated.name} restored`);
      invalidateMerchantData(queryClient);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const filtered = !!(q || stock || status !== 'ACTIVE');

  return (
    <div>
      <PageHeader
        title="Products"
        description="Prices, stock and availability you set here are what customers see."
        actions={
          <ButtonLink to="/merchant/products/new" icon={<Plus className="size-4" />}>
            Add product
          </ButtonLink>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 md:flex-row">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search your products"
            className="flex-1"
          />
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
              setPage(1);
            }}
            aria-label="Filter by status"
            className="md:w-40"
          >
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
            <option value="">All</option>
          </Select>
          <Select
            value={stock}
            onChange={(event) => {
              setStock(event.target.value as typeof stock);
              setPage(1);
            }}
            aria-label="Filter by stock"
            className="md:w-44"
          >
            <option value="">Any stock</option>
            <option value="in_stock">In stock</option>
            <option value="out_of_stock">Out of stock</option>
          </Select>
        </div>
        {productsQuery.isPending ? (
          <LoadingState />
        ) : productsQuery.isError ? (
          <ErrorState error={productsQuery.error} onRetry={() => void productsQuery.refetch()} />
        ) : productsQuery.data.items.length === 0 ? (
          <EmptyState
            icon={<Package className="size-6" />}
            title={filtered ? 'No products match' : 'No products yet'}
            description={filtered ? 'Try different filters.' : 'Add your first product so customers can find it.'}
            action={filtered ? undefined : <ButtonLink to="/merchant/products/new">Add product</ButtonLink>}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th className="text-right">Price</Th>
                  <Th>Stock</Th>
                  <Th>Selling</Th>
                  <Th>Status</Th>
                  <Th className="text-right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {productsQuery.data.items.map((product) => (
                  <tr key={product.id} className="cursor-pointer hover:bg-ink-50" onClick={() => navigate(`/merchant/products/${product.id}`)}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <ImageWithFallback src={product.imageUrl} alt="" className="size-11 shrink-0 rounded-lg" iconClassName="size-5" />
                        <div className="min-w-0">
                          <Link
                            to={`/merchant/products/${product.id}`}
                            className="line-clamp-1 font-medium text-ink-950 hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {product.name}
                          </Link>
                          <p className="text-xs text-ink-500">{product.category.name}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-right font-medium text-ink-900">{formatMoney(product.price)}</Td>
                    <Td>
                      <StockBadge product={product} />
                    </Td>
                    <Td>{product.isAvailable ? <Badge tone="success">On</Badge> : <Badge>Paused</Badge>}</Td>
                    <Td>
                      <StatusBadge status={product.status} />
                    </Td>
                    <Td className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          archive.mutate(product);
                        }}
                        disabled={archive.isPending && archive.variables?.id === product.id}
                      >
                        {product.status === 'ACTIVE' ? 'Archive' : 'Restore'}
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="px-4">
              <Pagination meta={productsQuery.data.meta} onPageChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
