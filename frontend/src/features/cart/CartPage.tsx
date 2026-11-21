import type { CartLine } from '@marketplace/contracts';
import { ArrowRight, ShoppingBag, Store, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { formatMoney, pluralize } from '../../lib/format';
import { useCart } from './CartProvider';
import { LineIssueBadge } from './LineIssueBadge';

export function CartPage() {
  const { mode, cart, isLoading, error, refetch, pending, setQuantity, removeLines } = useCart();
  const navigate = useNavigate();

  if (mode === 'unavailable') {
    return (
      <EmptyState
        className="py-24"
        icon={<ShoppingBag className="size-6" />}
        title="Carts are for customer accounts"
        description="Merchant and administrator accounts cannot place orders. Sign in with a customer account to shop."
      />
    );
  }

  const readyToOrder = Boolean(cart && cart.shops.length > 0 && !cart.hasIssues && !pending);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:pb-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Your cart</h1>
      {isLoading ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !cart || cart.shops.length === 0 ? (
        <EmptyState
          className="py-20"
          icon={<ShoppingBag className="size-6" />}
          title="Your cart is empty"
          description="Find a shop on the map or search for a product to get started."
          action={<ButtonLink to="/">Explore shops</ButtonLink>}
        />
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-500">
            {pluralize(cart.itemCount, 'item')} from {pluralize(cart.shops.length, 'shop')}. Each shop prepares its own
            part of your order.
          </p>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              {cart.shops.map((group) => (
                <Card key={group.shopId}>
                  <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3">
                    <Link
                      to={`/shops/${group.shopSlug}`}
                      className="flex items-center gap-2 font-semibold text-ink-950 hover:underline"
                    >
                      <Store className="size-4 text-accent-700" /> {group.shopName}
                    </Link>
                    <span className="text-sm text-ink-500">Subtotal {formatMoney(group.subtotal)}</span>
                  </div>
                  <ul className="divide-y divide-ink-100">
                    {group.items.map((line) => (
                      <CartLineRow
                        key={line.id}
                        line={line}
                        disabled={pending}
                        onQuantity={(quantity) => void setQuantity(line, quantity)}
                        onRemove={() => void removeLines([line])}
                      />
                    ))}
                  </ul>
                </Card>
              ))}
            </div>

            <Card className="h-fit p-5 lg:sticky lg:top-24">
              <h2 className="text-base font-semibold text-ink-950">Summary</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-600">Items</dt>
                  <dd className="font-medium text-ink-900">{cart.itemCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-600">Merchandise subtotal</dt>
                  <dd className="font-medium text-ink-900">{formatMoney(cart.merchandiseSubtotal)}</dd>
                </div>
                <div className="flex justify-between text-ink-500">
                  <dt>Delivery</dt>
                  <dd>Calculated at checkout</dd>
                </div>
              </dl>
              {cart.hasIssues ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <p>Some items cannot be bought right now and are not counted in the total.</p>
                  <button
                    type="button"
                    className="mt-2 font-semibold underline underline-offset-4"
                    onClick={() =>
                      void removeLines(cart.shops.flatMap((group) => group.items.filter((line) => line.issue === 'NOT_FOUND' || line.issue === 'UNAVAILABLE')))
                    }
                  >
                    Remove unavailable items
                  </button>
                </div>
              ) : null}
              <div className="hidden lg:block">
                <OrderButton mode={mode} disabled={!readyToOrder} onNavigate={navigate} />
              </div>
              {mode === 'guest' ? (
                <p className="mt-3 text-center text-xs text-ink-500">Your cart is kept on this device and moves into your account when you sign in.</p>
              ) : null}
            </Card>
          </div>
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white p-4 pr-20 shadow-[0_-8px_24px_rgba(28,25,23,0.08)] lg:hidden">
            <div className="mb-3 flex items-baseline justify-between text-sm">
              <span className="text-ink-600">Merchandise subtotal</span>
              <span className="font-semibold text-ink-950">{formatMoney(cart.merchandiseSubtotal)}</span>
            </div>
            <OrderButton mode={mode} disabled={!readyToOrder} onNavigate={navigate} />
          </div>
        </>
      )}
    </div>
  );
}

function OrderButton({
  mode,
  disabled,
  onNavigate,
}: {
  mode: 'guest' | 'customer';
  disabled: boolean;
  onNavigate: (path: string, options?: { state: { from: string } }) => void;
}) {
  if (mode === 'guest') {
    return (
      <Button size="lg" className="w-full" onClick={() => onNavigate('/login', { state: { from: '/checkout' } })}>
        Sign in to check out
      </Button>
    );
  }
  return (
    <Button size="lg" className="w-full" disabled={disabled} onClick={() => onNavigate('/checkout')}>
      Place order <ArrowRight className="size-4" />
    </Button>
  );
}

function CartLineRow({
  line,
  disabled,
  onQuantity,
  onRemove,
}: {
  line: CartLine;
  disabled: boolean;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const purchasable = line.issue === null;
  return (
    <li className="flex gap-4 px-5 py-4">
      <Link to={`/products/${line.productId}`} className="shrink-0">
        <ImageWithFallback src={line.imageUrl} alt={line.name} className="size-20 rounded-xl" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link to={`/products/${line.productId}`} className="line-clamp-2 text-sm font-medium text-ink-900 hover:underline">
            {line.name}
          </Link>
          <p className="mt-0.5 text-sm text-ink-500">{formatMoney(line.unitPrice)} each</p>
          {line.issue ? (
            <div className="mt-1.5">
              <LineIssueBadge issue={line.issue} />
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          <p className={purchasable ? 'text-sm font-semibold text-ink-950' : 'text-sm text-ink-400 line-through'}>
            {formatMoney(line.lineTotal)}
          </p>
          <div className="flex items-center gap-2">
            {line.issue !== 'NOT_FOUND' ? (
              <QuantityStepper value={line.quantity} onChange={onQuantity} disabled={disabled} size="sm" />
            ) : null}
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-red-600 disabled:opacity-50"
              aria-label={`Remove ${line.name}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
