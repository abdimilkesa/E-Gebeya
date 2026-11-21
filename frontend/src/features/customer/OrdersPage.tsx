import { ChevronRight, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui/States';
import { formatDateTime, formatMoney, pluralize } from '../../lib/format';
import { useCustomerOrders } from './queries';
import { OrderFulfillmentBadge, OrderPaymentBadge } from './status';

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const ordersQuery = useCustomerOrders({ page });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Your orders"
        description="One order can include several shops. Each shop prepares and ships its own part."
      />
      {ordersQuery.isPending ? (
        <LoadingState />
      ) : ordersQuery.isError ? (
        <ErrorState error={ordersQuery.error} onRetry={() => void ordersQuery.refetch()} />
      ) : ordersQuery.data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ReceiptText className="size-6" />}
            title="No orders yet"
            description="Orders you place appear here with each shop's progress."
            action={<ButtonLink to="/">Explore shops</ButtonLink>}
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-ink-100">
            {ordersQuery.data.items.map((order) => (
              <li key={order.id}>
                <Link
                  to={`/account/orders/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-ink-50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-950">{order.orderNumber}</p>
                    <p className="text-sm text-ink-500">
                      {formatDateTime(order.createdAt)} · {pluralize(order.merchantOrderCount, 'shop')} ·{' '}
                      {order.paymentMethod === 'BANK_TRANSFER' ? 'Bank transfer' : 'Chapa'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <OrderPaymentBadge status={order.paymentStatus} />
                    <OrderFulfillmentBadge status={order.fulfillmentStatus} />
                    <span className="ml-2 font-semibold tabular-nums text-ink-950">{formatMoney(order.grandTotal)}</span>
                    <ChevronRight className="size-4 text-ink-400" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-ink-100 px-4">
            <Pagination meta={ordersQuery.data.meta} onPageChange={setPage} />
          </div>
        </Card>
      )}
    </div>
  );
}
