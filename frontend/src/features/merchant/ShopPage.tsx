import type { ManagedShop } from '@marketplace/contracts';
import { ExternalLink, Info, Lock } from 'lucide-react';
import { StatusBadge } from '../../components/ui/Badge';
import { ButtonLink } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui/States';
import { formatMoney, pluralize } from '../../lib/format';
import { googleMapsUrl } from '../discovery/queries';
import { useMerchantShops } from './queries';

export function ShopPage() {
  const shopsQuery = useMerchantShops();

  return (
    <div>
      <PageHeader title="My shop" description="How your shop appears to customers, and where payouts go." />
      <div className="mb-6 flex gap-2.5 rounded-xl border border-accent-200 bg-accent-50 p-4 text-sm text-accent-900">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Shop details, location and bank account are managed by the marketplace administrator, so customers can trust
          every pin on the map. Contact them to change anything here.
        </p>
      </div>
      {shopsQuery.isPending ? (
        <LoadingState />
      ) : shopsQuery.isError ? (
        <ErrorState error={shopsQuery.error} onRetry={() => void shopsQuery.refetch()} />
      ) : shopsQuery.data.length === 0 ? (
        <Card>
          <EmptyState title="No shop assigned yet" description="The administrator will register your shop and its location." />
        </Card>
      ) : (
        <div className="space-y-6">
          {shopsQuery.data.map((shop) => (
            <ShopDetails key={shop.id} shop={shop} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShopDetails({ shop }: { shop: ManagedShop }) {
  const rows: [string, string][] = [
    ['Address', shop.addressText],
    ['Phone', shop.phone],
    ['Coordinates', `${shop.latitude}, ${shop.longitude}`],
    ['Delivery fee', Number(shop.deliveryFeeEtb) > 0 ? formatMoney(shop.deliveryFeeEtb) : 'Free delivery'],
    ['Products', pluralize(shop.productCount, 'product')],
  ];
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-100 p-5">
        <div className="flex items-center gap-4">
          <ImageWithFallback src={shop.logoUrl} alt="" className="size-14 rounded-xl" iconClassName="size-6" />
          <div>
            <h2 className="text-lg font-semibold text-ink-950">{shop.name}</h2>
            <p className="text-sm text-ink-500">/{shop.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={shop.status} />
          {shop.status === 'ACTIVE' ? (
            <ButtonLink to={`/shops/${shop.slug}`} variant="secondary" size="sm" target="_blank" icon={<ExternalLink className="size-4" />}>
              Storefront
            </ButtonLink>
          ) : null}
        </div>
      </div>
      <div className="grid gap-6 p-5 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-ink-950">Shop details</h3>
          <dl className="mt-3 space-y-2 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-ink-500">{label}</dt>
                <dd className="text-right font-medium text-ink-900">{value}</dd>
              </div>
            ))}
          </dl>
          <a
            href={googleMapsUrl(shop.latitude, shop.longitude)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-ink-700 hover:text-ink-950"
          >
            <ExternalLink className="size-3.5" /> Check the pin in Google Maps
          </a>
          {shop.description ? <p className="mt-4 whitespace-pre-line text-sm text-ink-600">{shop.description}</p> : null}
        </div>
        <div>
          <CardHeader
            className="border-none p-0"
            title={
              <span className="flex items-center gap-2 text-sm">
                <Lock className="size-4 text-ink-400" /> Payout account
              </span>
            }
            description="Private: never shown to customers."
          />
          <dl className="mt-3 space-y-2 rounded-xl bg-ink-50 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Bank</dt>
              <dd className="font-medium text-ink-900">{shop.bankName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Account holder</dt>
              <dd className="font-medium text-ink-900">{shop.bankAccountName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Account number</dt>
              <dd className="font-mono font-medium text-ink-900">{shop.bankAccountNumber}</dd>
            </div>
          </dl>
        </div>
      </div>
    </Card>
  );
}
