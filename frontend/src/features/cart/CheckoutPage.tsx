import type { CheckoutQuote, FulfillmentPreference } from '@marketplace/contracts';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Info, PackageCheck, Store, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format';
import { LineIssueBadge } from './LineIssueBadge';

const OPTIONS: { value: FulfillmentPreference; title: string; description: string; icon: typeof Truck }[] = [
  { value: 'DELIVERY', title: 'Delivery', description: 'Each shop delivers its part. Shop delivery fees apply.', icon: Truck },
  { value: 'PICKUP', title: 'Pickup', description: 'Collect from each shop yourself. No delivery fees.', icon: PackageCheck },
];

export function CheckoutPage() {
  const [preference, setPreference] = useState<FulfillmentPreference>('DELIVERY');
  // Every amount on this page is recomputed by the server from live prices and stock.
  const quoteQuery = useQuery({
    queryKey: ['checkout-quote', preference],
    queryFn: () => api.post<CheckoutQuote>('/checkout/quote', { fulfillmentPreference: preference }),
    staleTime: 0,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <Link to="/cart" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-950">
        <ArrowLeft className="size-4" /> Back to cart
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Review checkout</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-ink-950">How do you want to receive your order?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors',
                    preference === option.value ? 'border-ink-950 ring-2 ring-accent-400/60' : 'border-ink-200 hover:border-ink-400',
                  )}
                >
                  <input
                    type="radio"
                    name="fulfillment"
                    value={option.value}
                    checked={preference === option.value}
                    onChange={() => setPreference(option.value)}
                    className="sr-only"
                  />
                  <option.icon className="mt-0.5 size-5 shrink-0 text-accent-700" />
                  <span>
                    <span className="block text-sm font-semibold text-ink-950">{option.title}</span>
                    <span className="block text-sm text-ink-500">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {quoteQuery.isPending ? (
            <Skeleton className="h-64" />
          ) : quoteQuery.isError ? (
            <ErrorState error={quoteQuery.error} onRetry={() => void quoteQuery.refetch()} />
          ) : quoteQuery.data.shops.length === 0 ? (
            <EmptyState title="Your cart is empty" action={<ButtonLink to="/">Explore shops</ButtonLink>} />
          ) : (
            <div className="space-y-4">
              {quoteQuery.data.shops.map((group) => (
                <Card key={group.shopId}>
                  <div className="flex items-center gap-2 border-b border-ink-100 px-5 py-3 font-semibold text-ink-950">
                    <Store className="size-4 text-accent-700" /> {group.shopName}
                  </div>
                  <ul className="divide-y divide-ink-100 px-5">
                    {group.items.map((line) => (
                      <li key={line.cartItemId} className="flex items-start justify-between gap-4 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-ink-900">{line.name}</p>
                          <p className="text-ink-500">
                            {line.quantity} × {formatMoney(line.unitPrice)}
                          </p>
                          {line.issue ? (
                            <div className="mt-1">
                              <LineIssueBadge issue={line.issue} />
                            </div>
                          ) : null}
                        </div>
                        <p className={line.issue ? 'text-ink-400 line-through' : 'font-medium text-ink-900'}>
                          {formatMoney(line.lineTotal)}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <dl className="space-y-1 border-t border-ink-100 px-5 py-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-ink-600">Subtotal</dt>
                      <dd>{formatMoney(group.subtotal)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-600">Delivery fee</dt>
                      <dd>{formatMoney(group.deliveryFee)}</dd>
                    </div>
                    <div className="flex justify-between font-semibold text-ink-950">
                      <dt>Shop total</dt>
                      <dd>{formatMoney(group.total)}</dd>
                    </div>
                  </dl>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card className="h-fit p-5 lg:sticky lg:top-24">
          <h2 className="text-base font-semibold text-ink-950">Order total</h2>
          {quoteQuery.data ? (
            <>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-600">Merchandise</dt>
                  <dd className="font-medium">{formatMoney(quoteQuery.data.merchandiseSubtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-600">Delivery fees</dt>
                  <dd className="font-medium">{formatMoney(quoteQuery.data.deliveryFeeTotal)}</dd>
                </div>
                <div className="flex justify-between border-t border-ink-100 pt-3 text-base font-semibold text-ink-950">
                  <dt>Total</dt>
                  <dd>{formatMoney(quoteQuery.data.grandTotal)}</dd>
                </div>
              </dl>
              {!quoteQuery.data.canCheckout && quoteQuery.data.shops.length > 0 ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  Some items changed since you added them.{' '}
                  <Link to="/cart" className="font-semibold underline underline-offset-4">
                    Update your cart
                  </Link>{' '}
                  to continue.
                </div>
              ) : null}
            </>
          ) : (
            <Skeleton className="mt-4 h-24" />
          )}
          <div className="mt-5 flex gap-2.5 rounded-xl bg-accent-50 p-3 text-sm text-accent-900">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>
              Prices, stock and fees above were just verified by the server. Placing the order and paying (Chapa or bank
              transfer) will be enabled in the next release.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
