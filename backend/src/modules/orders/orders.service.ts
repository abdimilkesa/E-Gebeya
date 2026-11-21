import type {
  CustomerMerchantOrder,
  CustomerOrder,
  CustomerOrdersQuery,
  OrderSummary,
} from '@marketplace/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { notFound } from '../../lib/errors.js';
import { iso, money } from '../../lib/format.js';
import { pageArgs } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';

const customerMerchantOrderSelect = {
  id: true,
  shopId: true,
  shopNameSnapshot: true,
  subtotal: true,
  deliveryFee: true,
  total: true,
  paymentStatus: true,
  fulfillmentStatus: true,
  cancellationReason: true,
  shop: { select: { slug: true, bankName: true, bankAccountName: true, bankAccountNumber: true } },
  items: {
    select: {
      id: true,
      productId: true,
      productNameSnapshot: true,
      unitPriceSnapshot: true,
      quantity: true,
      lineTotal: true,
    },
    orderBy: [{ productNameSnapshot: 'asc' }, { id: 'asc' }],
  },
  bankPayment: {
    select: {
      receipts: {
        select: { createdAt: true, rejectionReason: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  },
} satisfies Prisma.MerchantOrderSelect;

const customerOrderSelect = {
  id: true,
  orderNumber: true,
  createdAt: true,
  paymentMethod: true,
  fulfillmentPreference: true,
  contactName: true,
  addressName: true,
  houseNumber: true,
  phoneNumber: true,
  customerNote: true,
  merchandiseSubtotal: true,
  deliveryFeeTotal: true,
  grandTotal: true,
  paymentStatus: true,
  fulfillmentStatus: true,
  stockHoldState: true,
  stockHoldExpiresAt: true,
  merchantOrders: {
    select: customerMerchantOrderSelect,
    orderBy: [{ shopNameSnapshot: 'asc' }, { id: 'asc' }],
  },
  payments: {
    where: { method: 'CHAPA' },
    select: { status: true, checkoutUrl: true },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
} satisfies Prisma.OrderSelect;

type CustomerOrderRow = Prisma.OrderGetPayload<{ select: typeof customerOrderSelect }>;
type CustomerMerchantOrderRow = CustomerOrderRow['merchantOrders'][number];

function toCustomerMerchantOrder(
  row: CustomerMerchantOrderRow,
  isBankTransfer: boolean,
): CustomerMerchantOrder {
  const receipt = row.bankPayment?.receipts[0];
  return {
    id: row.id,
    shopId: row.shopId,
    shopName: row.shopNameSnapshot,
    shopSlug: row.shop.slug,
    subtotal: money(row.subtotal),
    deliveryFee: money(row.deliveryFee),
    total: money(row.total),
    paymentStatus: row.paymentStatus,
    fulfillmentStatus: row.fulfillmentStatus,
    cancellationReason: row.cancellationReason,
    items: row.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productNameSnapshot,
      unitPrice: money(item.unitPriceSnapshot),
      quantity: item.quantity,
      lineTotal: money(item.lineTotal),
    })),
    bank: isBankTransfer
      ? {
          bankName: row.shop.bankName,
          accountName: row.shop.bankAccountName,
          accountNumber: row.shop.bankAccountNumber,
          amount: money(row.total),
        }
      : null,
    receipt: receipt
      ? {
          status: row.paymentStatus,
          uploadedAt: iso(receipt.createdAt),
          rejectionReason: receipt.rejectionReason,
        }
      : null,
  };
}

function toCustomerOrder(row: CustomerOrderRow): CustomerOrder {
  const isBankTransfer = row.paymentMethod === 'BANK_TRANSFER';
  const attempt = row.payments[0];
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    createdAt: iso(row.createdAt),
    paymentMethod: row.paymentMethod,
    fulfillmentPreference: row.fulfillmentPreference,
    contact: {
      contactName: row.contactName,
      addressName: row.addressName,
      houseNumber: row.houseNumber,
      phoneNumber: row.phoneNumber,
    },
    customerNote: row.customerNote,
    currency: 'ETB',
    merchandiseSubtotal: money(row.merchandiseSubtotal),
    deliveryFeeTotal: money(row.deliveryFeeTotal),
    grandTotal: money(row.grandTotal),
    paymentStatus: row.paymentStatus,
    fulfillmentStatus: row.fulfillmentStatus,
    holdExpiresAt:
      row.stockHoldState === 'HELD' && row.stockHoldExpiresAt ? iso(row.stockHoldExpiresAt) : null,
    merchantOrders: row.merchantOrders.map((merchantOrder) =>
      toCustomerMerchantOrder(merchantOrder, isBankTransfer),
    ),
    paymentAttempt: attempt
      ? {
          status: attempt.status,
          checkoutUrl: attempt.status === 'PROCESSING' ? attempt.checkoutUrl : null,
        }
      : null,
  };
}

/** One of the caller's orders. Another customer's id is indistinguishable from a missing one. */
export async function getCustomerOrder(customerId: string, orderId: string): Promise<CustomerOrder> {
  const row = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    select: customerOrderSelect,
  });
  if (!row) throw notFound('Order');
  return toCustomerOrder(row);
}

export async function listCustomerOrders(
  customerId: string,
  query: CustomerOrdersQuery,
): Promise<{ items: OrderSummary[]; total: number }> {
  const where: Prisma.OrderWhereInput = {
    customerId,
    ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    ...(query.fulfillmentStatus ? { fulfillmentStatus: query.fulfillmentStatus } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        orderNumber: true,
        grandTotal: true,
        paymentMethod: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        createdAt: true,
        _count: { select: { merchantOrders: true } },
      },
      ...pageArgs(query.page, query.pageSize),
    }),
    prisma.order.count({ where }),
  ]);
  return {
    items: rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      grandTotal: money(row.grandTotal),
      paymentMethod: row.paymentMethod,
      paymentStatus: row.paymentStatus,
      fulfillmentStatus: row.fulfillmentStatus,
      createdAt: iso(row.createdAt),
      merchantOrderCount: row._count.merchantOrders,
    })),
    total,
  };
}
