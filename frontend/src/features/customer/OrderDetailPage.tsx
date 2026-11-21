import type { BankTransferInstructions, CustomerMerchantOrder, CustomerOrder } from '@marketplace/contracts';
import { ArrowLeft, CheckCircle2, Copy, Landmark, PackageCheck, Store, Truck } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';
import { Card } from '../../components/ui/Card';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { formatDateTime, formatMoney, pluralize } from '../../lib/format';
import { useCustomerOrder } from './queries';
import { OrderFulfillmentBadge, OrderPaymentBadge, ShopFulfillmentBadge, ShopPaymentBadge } from './status';

/** A bank-transfer sub-order that still needs the customer's money. */
const needsTransfer = (merchantOrder: CustomerMerchantOrder) =>
  merchantOrder.bank !== null &&
  merchantOrder.fulfillmentStatus !== 'CANCELLED' &&
  (merchantOrder.paymentStatus === 'PENDING' || merchantOrder.paymentStatus === 'REJECTED');

export function OrderDetailPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const justPlaced = (location.state as { placed?: unknown } | null)?.placed === true;
  const orderQuery = useCustomerOrder(orderId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        to="/account/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-950"
      >
        <ArrowLeft className="size-4" /> All orders
      </Link>
      {orderQuery.isPending ? (
        <LoadingState />
      ) : orderQuery.isError ? (
        <ErrorState error={orderQuery.error} onRetry={() => void orderQuery.refetch()} title="Could not load this order" />
      ) : (
        <OrderView order={orderQuery.data} justPlaced={justPlaced} />
      )}
    </div>
  );
}

function OrderView({ order, justPlaced }: { order: CustomerOrder; justPlaced: boolean }) {
  const toPay = order.merchantOrders.filter(needsTransfer);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Order {order.orderNumber}</h1>
          <p className="mt-1 text-sm text-ink-500">
            Placed {formatDateTime(order.createdAt)} · {pluralize(order.merchantOrders.length, 'shop')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <OrderPaymentBadge status={order.paymentStatus} />
          <OrderFulfillmentBadge status={order.fulfillmentStatus} />
        </div>
      </div>

      {justPlaced ? (
        <div
          role="status"
          className="mt-6 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <p>
            <span className="font-semibold">Your order is placed.</span> Each shop starts preparing its part once your
            payment to that shop is confirmed.
          </p>
        </div>
      ) : null}

      {toPay.length > 0 ? (
        <Card className="mt-6 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-950">
            <Landmark className="size-5 text-accent-700" /> How to pay
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            Transfer each amount below to that shop's own bank account and keep your receipt.
            {order.holdExpiresAt ? ` Your items are reserved until ${formatDateTime(order.holdExpiresAt)}.` : null}
          </p>
          <p className="mt-3 text-sm font-medium text-ink-900">
            {pluralize(toPay.length, 'transfer')} to make ·{' '}
            {formatMoney(toPay.reduce((sum, merchantOrder) => sum + Number(merchantOrder.total), 0))} in total
          </p>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {order.merchantOrders.map((merchantOrder) => (
            <MerchantOrderCard key={merchantOrder.id} merchantOrder={merchantOrder} />
          ))}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="text-base font-semibold text-ink-950">Summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-600">Merchandise</dt>
                <dd className="font-medium">{formatMoney(order.merchandiseSubtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-600">Delivery fees</dt>
                <dd className="font-medium">{formatMoney(order.deliveryFeeTotal)}</dd>
              </div>
              <div className="flex justify-between border-t border-ink-100 pt-3 text-base font-semibold text-ink-950">
                <dt>Total</dt>
                <dd>{formatMoney(order.grandTotal)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm text-ink-500">
              Paid by {order.paymentMethod === 'BANK_TRANSFER' ? 'bank transfer to each shop' : 'Chapa'}
            </p>
          </Card>
          <Card className="p-5 text-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink-950">
              {order.fulfillmentPreference === 'DELIVERY' ? (
                <Truck className="size-4 text-accent-700" />
              ) : (
                <PackageCheck className="size-4 text-accent-700" />
              )}
              {order.fulfillmentPreference === 'DELIVERY' ? 'Delivery' : 'Pickup from each shop'}
            </h2>
            <dl className="mt-3 space-y-1.5 text-ink-700">
              <dd className="font-medium text-ink-900">{order.contact.contactName}</dd>
              <dd>
                {order.contact.addressName}, house {order.contact.houseNumber}
              </dd>
              <dd>{order.contact.phoneNumber}</dd>
            </dl>
            {order.customerNote ? (
              <p className="mt-3 rounded-xl bg-ink-50 p-3 text-ink-700">
                <span className="font-medium text-ink-900">Note: </span>
                {order.customerNote}
              </p>
            ) : null}
          </Card>
        </aside>
      </div>
    </>
  );
}

function MerchantOrderCard({ merchantOrder }: { merchantOrder: CustomerMerchantOrder }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-3">
        <Link
          to={`/shops/${merchantOrder.shopSlug}`}
          className="flex items-center gap-2 font-semibold text-ink-950 hover:underline"
        >
          <Store className="size-4 text-accent-700" /> {merchantOrder.shopName}
        </Link>
        <div className="flex flex-wrap gap-2">
          <ShopPaymentBadge status={merchantOrder.paymentStatus} />
          <ShopFulfillmentBadge status={merchantOrder.fulfillmentStatus} />
        </div>
      </div>
      <ul className="divide-y divide-ink-100 px-5">
        {merchantOrder.items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-4 py-3 text-sm">
            <div className="min-w-0">
              <Link to={`/products/${item.productId}`} className="font-medium text-ink-900 hover:underline">
                {item.productName}
              </Link>
              <p className="text-ink-500">
                {item.quantity} × {formatMoney(item.unitPrice)}
              </p>
            </div>
            <p className="font-medium text-ink-900">{formatMoney(item.lineTotal)}</p>
          </li>
        ))}
      </ul>
      <dl className="space-y-1 border-t border-ink-100 px-5 py-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-600">Subtotal</dt>
          <dd>{formatMoney(merchantOrder.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-600">Delivery fee</dt>
          <dd>{formatMoney(merchantOrder.deliveryFee)}</dd>
        </div>
        <div className="flex justify-between font-semibold text-ink-950">
          <dt>Shop total</dt>
          <dd>{formatMoney(merchantOrder.total)}</dd>
        </div>
      </dl>
      {merchantOrder.cancellationReason ? (
        <p className="border-t border-ink-100 px-5 py-3 text-sm text-red-700">
          Cancelled by the shop: {merchantOrder.cancellationReason}
        </p>
      ) : null}
      {merchantOrder.receipt?.rejectionReason && merchantOrder.paymentStatus === 'REJECTED' ? (
        <p className="border-t border-ink-100 px-5 py-3 text-sm text-red-700">
          Receipt rejected: {merchantOrder.receipt.rejectionReason}
        </p>
      ) : null}
      {needsTransfer(merchantOrder) && merchantOrder.bank ? <BankDetails bank={merchantOrder.bank} /> : null}
    </Card>
  );
}

function BankDetails({ bank }: { bank: BankTransferInstructions }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(bank.accountNumber);
      toast.success('Account number copied');
    } catch {
      toast.error('Could not copy. Select the number and copy it instead.');
    }
  };
  return (
    <div className="border-t border-ink-100 bg-accent-50/40 px-5 py-4 text-sm">
      <p className="font-semibold text-ink-950">Transfer {formatMoney(bank.amount)} to</p>
      <dl className="mt-2 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-ink-500">Bank</dt>
          <dd className="font-medium text-ink-900">{bank.bankName}</dd>
        </div>
        <div>
          <dt className="text-ink-500">Account name</dt>
          <dd className="font-medium text-ink-900">{bank.accountName}</dd>
        </div>
        <div>
          <dt className="text-ink-500">Account number</dt>
          <dd className="flex items-center gap-1.5 font-mono font-medium text-ink-900">
            {bank.accountNumber}
            <button
              type="button"
              onClick={() => void copy()}
              className="rounded-md p-1 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
              aria-label="Copy account number"
            >
              <Copy className="size-4" />
            </button>
          </dd>
        </div>
      </dl>
    </div>
  );
}
