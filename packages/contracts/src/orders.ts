import { z } from 'zod';
import { paginationQuerySchema } from './common.js';
import type { DeliveryContact } from './customer.js';
import {
  PARENT_FULFILLMENT_STATUSES,
  PARENT_PAYMENT_STATUSES,
  type FulfillmentPreference,
  type MerchantFulfillmentStatus,
  type MerchantPaymentStatus,
  type ParentFulfillmentStatus,
  type ParentPaymentStatus,
  type PaymentMethod,
  type PaymentRecordStatus,
} from './enums.js';

export const customerOrdersQuerySchema = paginationQuerySchema.extend({
  paymentStatus: z.enum(PARENT_PAYMENT_STATUSES).optional(),
  fulfillmentStatus: z.enum(PARENT_FULFILLMENT_STATUSES).optional(),
});
export type CustomerOrdersQuery = z.infer<typeof customerOrdersQuerySchema>;

export interface OrderSummary {
  id: string;
  orderNumber: string;
  grandTotal: string;
  paymentMethod: PaymentMethod;
  paymentStatus: ParentPaymentStatus;
  fulfillmentStatus: ParentFulfillmentStatus;
  createdAt: string;
  merchantOrderCount: number;
}

/** A line as it was bought: name and unit price are copies taken at checkout. */
export interface OrderItemSnapshot {
  id: string;
  productId: string;
  productName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

/** Where to send a bank transfer for one shop. Only the buyer's own order payloads carry it. */
export interface BankTransferInstructions {
  bankName: string;
  accountName: string;
  accountNumber: string;
  amount: string;
}

export interface ReceiptSummary {
  status: MerchantPaymentStatus;
  uploadedAt: string;
  rejectionReason: string | null;
}

export interface CustomerMerchantOrder {
  id: string;
  shopId: string;
  shopName: string;
  shopSlug: string;
  subtotal: string;
  deliveryFee: string;
  total: string;
  paymentStatus: MerchantPaymentStatus;
  fulfillmentStatus: MerchantFulfillmentStatus;
  cancellationReason: string | null;
  items: OrderItemSnapshot[];
  /** Present for bank-transfer orders. */
  bank: BankTransferInstructions | null;
  /** Latest receipt uploaded for this sub-order's bank transfer, if any. */
  receipt: ReceiptSummary | null;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  paymentMethod: PaymentMethod;
  fulfillmentPreference: FulfillmentPreference;
  contact: DeliveryContact;
  customerNote: string | null;
  currency: 'ETB';
  merchandiseSubtotal: string;
  deliveryFeeTotal: string;
  grandTotal: string;
  paymentStatus: ParentPaymentStatus;
  fulfillmentStatus: ParentFulfillmentStatus;
  /** Unpaid parts of the order are released after this time; null once nothing is held. */
  holdExpiresAt: string | null;
  merchantOrders: CustomerMerchantOrder[];
  /** Latest Chapa attempt; null for bank transfer. */
  paymentAttempt: { status: PaymentRecordStatus; checkoutUrl: string | null } | null;
}
