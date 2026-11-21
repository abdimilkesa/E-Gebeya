import type { PublicProduct } from '@marketplace/contracts';
import { Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { Skeleton } from '../../components/ui/States';
import { Spinner } from '../../components/ui/Spinner';
import { formatMoney } from '../../lib/format';
import { useCart } from '../cart/CartProvider';

export function ProductCard({ product, showShop = true }: { product: PublicProduct; showShop?: boolean }) {
  const { mode, addItem } = useCart();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const canAdd = product.canPurchase && mode !== 'unavailable';
  const busy = adding || ordering;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card transition-shadow hover:shadow-pop">
      <Link to={`/products/${product.id}`} className="absolute inset-0 z-10" aria-label={product.name} />
      <div className="relative aspect-square overflow-hidden bg-ink-50">
        <ImageWithFallback
          src={product.imageUrl}
          alt={product.name}
          className="size-full transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {!product.canPurchase ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-ink-700 shadow-sm">
            Currently unavailable
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-accent-700">{product.category.name}</p>
        <h3 className="line-clamp-2 text-sm font-medium text-ink-900">{product.name}</h3>
        {showShop ? <p className="truncate text-xs text-ink-500">{product.shop.name}</p> : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <p className="text-base font-semibold text-ink-950">{formatMoney(product.price)}</p>
          {canAdd ? (
            <div className="relative z-20 flex items-center gap-1.5">
              {mode === 'customer' ? (
                <button
                  type="button"
                  aria-label={`Order ${product.name}`}
                  disabled={busy}
                  onClick={async () => {
                    setOrdering(true);
                    const added = await addItem(product.id, 1);
                    setOrdering(false);
                    if (added) navigate('/checkout');
                  }}
                  className="flex h-9 items-center rounded-xl bg-accent-400 px-2.5 text-xs font-semibold text-ink-950 transition-colors hover:bg-accent-300 disabled:opacity-60"
                >
                  {ordering ? <Spinner className="size-4" /> : 'Order'}
                </button>
              ) : null}
              <button
                type="button"
                aria-label={`Add ${product.name} to cart`}
                disabled={busy}
                onClick={async () => {
                  setAdding(true);
                  await addItem(product.id, 1);
                  setAdding(false);
                }}
                className="flex size-9 items-center justify-center rounded-xl bg-ink-950 text-white transition-colors hover:bg-ink-800 disabled:opacity-60"
              >
                {adding ? <Spinner className="size-4" /> : <Plus className="size-4" />}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{children}</div>;
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ProductGrid>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-ink-100 bg-white">
          <Skeleton className="aspect-square rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      ))}
    </ProductGrid>
  );
}
