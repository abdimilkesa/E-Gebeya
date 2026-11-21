import { MONEY_PATTERN, PRODUCT_SORTS, type ProductSort } from '@marketplace/contracts';
import { SearchX, SlidersHorizontal } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Input, Select, Switch } from '../../components/ui/Form';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { pluralize } from '../../lib/format';
import { ProductCard, ProductGrid, ProductGridSkeleton } from './ProductCard';
import { useCategories, usePublicProducts } from './queries';
import { SORT_LABELS } from './StorefrontPage';

const validMoney = (value: string | null) => (value && MONEY_PATTERN.test(value) ? value : undefined);

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const categoriesQuery = useCategories();
  const q = params.get('q')?.trim() ?? '';
  const category = params.get('category') ?? '';
  const minPrice = validMoney(params.get('minPrice'));
  const maxPrice = validMoney(params.get('maxPrice'));
  const available = params.get('available') === 'true';
  const sortParam = params.get('sort') as ProductSort | null;
  const sort: ProductSort =
    sortParam && PRODUCT_SORTS.includes(sortParam) && (sortParam !== 'relevance' || q)
      ? sortParam
      : q
        ? 'relevance'
        : 'newest';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [priceDraft, setPriceDraft] = useState({ min: minPrice ?? '', max: maxPrice ?? '' });
  const [priceError, setPriceError] = useState<string | null>(null);

  const productsQuery = usePublicProducts({
    q: q || undefined,
    category: category || undefined,
    minPrice,
    maxPrice,
    available: available ? 'true' : undefined,
    sort,
    page,
    pageSize: 24,
  });

  const setParam = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  const applyPrice = (event: FormEvent) => {
    event.preventDefault();
    const min = priceDraft.min.trim();
    const max = priceDraft.max.trim();
    if ((min && !MONEY_PATTERN.test(min)) || (max && !MONEY_PATTERN.test(max))) {
      setPriceError('Use amounts like 150 or 150.50');
      return;
    }
    if (min && max && Number(min) > Number(max)) {
      setPriceError('Minimum cannot be more than maximum');
      return;
    }
    setPriceError(null);
    setParam({ minPrice: min || null, maxPrice: max || null });
  };

  const hasFilters = !!(q || category || minPrice || maxPrice || available);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950">{q ? `Results for “${q}”` : 'All products'}</h1>
        <p className="mt-1 text-sm text-ink-500" aria-live="polite">
          {productsQuery.data ? `${pluralize(productsQuery.data.meta.total, 'product')} from shops across the city` : '\u00a0'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start" aria-label="Filters">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-950">
            <SlidersHorizontal className="size-4" /> Filters
          </p>
          <div className="space-y-1.5">
            <label htmlFor="filter-category" className="text-sm font-medium text-ink-800">
              Category
            </label>
            <Select id="filter-category" value={category} onChange={(event) => setParam({ category: event.target.value || null })}>
              <option value="">All categories</option>
              {categoriesQuery.data?.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </Select>
          </div>
          <form onSubmit={applyPrice} className="space-y-1.5" noValidate>
            <p className="text-sm font-medium text-ink-800">Price (ETB)</p>
            <div className="flex items-center gap-2">
              <Input
                inputMode="decimal"
                placeholder="Min"
                aria-label="Minimum price"
                value={priceDraft.min}
                onChange={(event) => setPriceDraft((value) => ({ ...value, min: event.target.value }))}
                invalid={!!priceError}
              />
              <span className="text-ink-400">–</span>
              <Input
                inputMode="decimal"
                placeholder="Max"
                aria-label="Maximum price"
                value={priceDraft.max}
                onChange={(event) => setPriceDraft((value) => ({ ...value, max: event.target.value }))}
                invalid={!!priceError}
              />
            </div>
            {priceError ? <p className="text-sm text-red-600">{priceError}</p> : null}
            <Button type="submit" variant="secondary" size="sm" className="w-full">
              Apply price
            </Button>
          </form>
          <Switch
            label="Available now"
            description="Hide items that are out of stock."
            checked={available}
            onChange={(event) => setParam({ available: event.target.checked ? 'true' : null })}
          />
          <div className="space-y-1.5">
            <label htmlFor="filter-sort" className="text-sm font-medium text-ink-800">
              Sort by
            </label>
            <Select id="filter-sort" value={sort} onChange={(event) => setParam({ sort: event.target.value })}>
              {PRODUCT_SORTS.filter((value) => value !== 'relevance' || q).map((value) => (
                <option key={value} value={value}>
                  {value === 'relevance' ? 'Best match' : SORT_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setPriceDraft({ min: '', max: '' });
                setParams(new URLSearchParams(), { replace: true });
              }}
            >
              Clear all filters
            </Button>
          ) : null}
        </aside>

        <section aria-label="Products">
          {productsQuery.isPending ? (
            <ProductGridSkeleton count={12} />
          ) : productsQuery.isError ? (
            <ErrorState error={productsQuery.error} onRetry={() => void productsQuery.refetch()} />
          ) : productsQuery.data.items.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No products found"
              description={hasFilters ? 'Try fewer filters or a different word.' : 'Shops have not listed products yet.'}
            />
          ) : (
            <div className={productsQuery.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
              <ProductGrid>
                {productsQuery.data.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </ProductGrid>
              <Pagination meta={productsQuery.data.meta} onPageChange={(next) => setParam({ page: String(next) })} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
