import { PRODUCT_SORTS, type ProductSort } from '@marketplace/contracts';
import { ExternalLink, MapPin, Phone, Search, Truck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { ApiError } from '../../lib/api';
import { Select } from '../../components/ui/Form';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { ButtonLink } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import { formatMoney, pluralize } from '../../lib/format';
import { ProductCard, ProductGrid, ProductGridSkeleton } from './ProductCard';
import { googleMapsUrl, usePublicProducts, usePublicShop } from './queries';
import { ShopAvatar } from './ShopCard';

export const SORT_LABELS: Record<ProductSort, string> = {
  relevance: 'Recommended',
  newest: 'Newest',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
};

export function StorefrontPage() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const shopQuery = usePublicShop(slug);
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const sortParam = params.get('sort') as ProductSort | null;
  const sort: ProductSort = sortParam && PRODUCT_SORTS.includes(sortParam) ? sortParam : 'relevance';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [draft, setDraft] = useState(q);

  const productsQuery = usePublicProducts(
    { shop: slug, q: q || undefined, category: category || undefined, sort, page, pageSize: 24 },
    shopQuery.isSuccess,
  );

  const setParam = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  if (shopQuery.isPending) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="mt-6 h-8 w-64" />
        <div className="mt-8">
          <ProductGridSkeleton />
        </div>
      </div>
    );
  }

  if (shopQuery.isError) {
    const missing = shopQuery.error instanceof ApiError && shopQuery.error.status === 404;
    return missing ? (
      <EmptyState
        className="py-24"
        title="This shop is not available"
        description="It may have been closed or the link is wrong."
        action={<ButtonLink to="/">Browse the map</ButtonLink>}
      />
    ) : (
      <ErrorState error={shopQuery.error} onRetry={() => void shopQuery.refetch()} className="py-24" />
    );
  }

  const shop = shopQuery.data;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setParam({ q: draft.trim() || null });
  };

  return (
    <div>
      <div className="relative h-40 overflow-hidden bg-ink-950 sm:h-56">
        {shop.coverUrl ? (
          <ImageWithFallback src={shop.coverUrl} alt="" className="size-full opacity-90" eager />
        ) : (
          <div className="size-full bg-[radial-gradient(circle_at_20%_20%,rgba(240,180,41,0.35),transparent_45%),radial-gradient(circle_at_80%_60%,rgba(240,180,41,0.18),transparent_40%)]" />
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="-mt-10 flex flex-col gap-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-card sm:-mt-14 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <ShopAvatar shop={shop} className="size-16 text-2xl sm:size-20" />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-ink-950">{shop.name}</h1>
              <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-600">
                <MapPin className="mt-0.5 size-4 shrink-0" /> {shop.addressText}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-600">
                <a href={`tel:${shop.phone}`} className="flex items-center gap-1.5 hover:text-ink-950">
                  <Phone className="size-4" /> {shop.phone}
                </a>
                <span className="flex items-center gap-1.5">
                  <Truck className="size-4" />
                  {Number(shop.deliveryFeeEtb) > 0 ? `Delivery ${formatMoney(shop.deliveryFeeEtb)}` : 'Free delivery'}
                </span>
                <span>{pluralize(shop.productCount, 'product')}</span>
              </div>
              {shop.description ? <p className="mt-3 max-w-2xl whitespace-pre-line text-sm text-ink-700">{shop.description}</p> : null}
            </div>
          </div>
          <a
            href={googleMapsUrl(shop.latitude, shop.longitude)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl border border-ink-200 px-3 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50"
          >
            <ExternalLink className="size-4" /> Directions
          </a>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <form onSubmit={submit} className="relative w-full sm:max-w-xs" role="search">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`Search ${shop.name}`}
              aria-label="Search this shop"
              maxLength={100}
              className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-sm placeholder:text-ink-400 focus:border-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-400/60"
            />
          </form>
          <Select
            value={sort}
            onChange={(event) => setParam({ sort: event.target.value === 'relevance' ? null : event.target.value })}
            aria-label="Sort products"
            className="sm:w-52"
          >
            {PRODUCT_SORTS.map((value) => (
              <option key={value} value={value}>
                {SORT_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>

        {shop.categories.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Filter by category">
            {[{ slug: '', name: 'All products', id: 'all' }, ...shop.categories].map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={category === item.slug}
                onClick={() => setParam({ category: item.slug || null })}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                  category === item.slug
                    ? 'border-ink-950 bg-ink-950 text-white'
                    : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400',
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
        ) : null}

        <div className="py-6">
          {productsQuery.isPending ? (
            <ProductGridSkeleton />
          ) : productsQuery.isError ? (
            <ErrorState error={productsQuery.error} onRetry={() => void productsQuery.refetch()} />
          ) : productsQuery.data.items.length === 0 ? (
            <EmptyState
              title={q || category ? 'No products match' : 'No products yet'}
              description={q || category ? 'Try another search or category.' : 'This shop has not listed any products yet.'}
            />
          ) : (
            <>
              <ProductGrid>
                {productsQuery.data.items.map((product) => (
                  <ProductCard key={product.id} product={product} showShop={false} />
                ))}
              </ProductGrid>
              <Pagination meta={productsQuery.data.meta} onPageChange={(next) => setParam({ page: String(next) })} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
