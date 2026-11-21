import type { PublicShopSummary } from '@marketplace/contracts';
import { ArrowRight, MapPin, Package } from 'lucide-react';
import { Link } from 'react-router';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { cn } from '../../lib/cn';
import { pluralize } from '../../lib/format';

export function ShopAvatar({ shop, className }: { shop: { name: string; logoUrl: string | null }; className?: string }) {
  if (shop.logoUrl) {
    return <ImageWithFallback src={shop.logoUrl} alt="" className={cn('size-12 shrink-0 rounded-xl', className)} />;
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-xl bg-ink-950 text-lg font-semibold text-accent-400',
        className,
      )}
    >
      {shop.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Shop row for the map sidebar. Selecting it highlights the pin; the link opens the storefront. */
export function ShopListItem({
  shop,
  selected,
  onSelect,
}: {
  shop: PublicShopSummary;
  selected: boolean;
  onSelect?: () => void;
}) {
  return (
    <li
      className={cn(
        'rounded-2xl border bg-white p-4 transition-colors',
        selected ? 'border-ink-900 ring-2 ring-accent-400/60' : 'border-ink-100 hover:border-ink-300',
      )}
    >
      <button type="button" onClick={onSelect} className="flex w-full gap-3 text-left" aria-pressed={selected}>
        <ShopAvatar shop={shop} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-ink-950">{shop.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-ink-500">
            <MapPin className="size-3.5 shrink-0" />
            {shop.addressText}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-500">
            <Package className="size-3.5 shrink-0" />
            {pluralize(shop.productCount, 'product')}
          </p>
        </div>
      </button>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {shop.categories.slice(0, 3).map((category) => (
            <span key={category.id} className="truncate rounded-full bg-ink-50 px-2 py-0.5 text-xs text-ink-600">
              {category.name}
            </span>
          ))}
        </div>
        <Link
          to={`/shops/${shop.slug}`}
          className="flex shrink-0 items-center gap-1 text-sm font-medium text-ink-950 hover:underline"
        >
          Visit <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </li>
  );
}
