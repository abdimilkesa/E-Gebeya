import { z } from 'zod';
import { fullNameSchema } from './auth.js';
import { mobilePhoneSchema, uuidSchema } from './common.js';
import { addressNameSchema, houseNumberSchema } from './customer.js';
import { FULFILLMENT_PREFERENCES, PAYMENT_METHODS } from './enums.js';
import type { FulfillmentPreference, LineIssue, PaymentMethod } from './enums.js';
import type { CustomerOrder } from './orders.js';

export const checkoutQuoteSchema = z.object({
  fulfillmentPreference: z.enum(FULFILLMENT_PREFERENCES),
});
export type CheckoutQuoteInput = z.infer<typeof checkoutQuoteSchema>;

export interface QuoteLine {
  cartItemId: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  issue: LineIssue | null;
}

export interface QuoteShopGroup {
  shopId: string;
  shopName: string;
  shopSlug: string;
  items: QuoteLine[];
  subtotal: string;
  deliveryFee: string;
  total: string;
}

/**
 * Server-computed checkout summary. Every amount comes from the database at request
 * time; nothing the browser remembers is trusted.
 */
export interface CheckoutQuote {
  fulfillmentPreference: FulfillmentPreference;
  currency: 'ETB';
  shops: QuoteShopGroup[];
  merchandiseSubtotal: string;
  deliveryFeeTotal: string;
  grandTotal: string;
  canCheckout: boolean;
  issues: { cartItemId: string; productId: string; name: string; issue: LineIssue }[];
  /** Payment methods this server can take right now. */
  paymentMethods: PaymentMethod[];
}

/** Header that makes `POST /checkout` safe to retry: a replay returns the original order. */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
export const idempotencyKeySchema = z
  .string({ error: 'Send an Idempotency-Key header' })
  .regex(/^[A-Za-z0-9_-]{8,80}$/, 'Idempotency-Key must be 8-80 letters, digits, "-" or "_"');

const typedContactFields = ['contactName', 'addressName', 'houseNumber', 'phoneNumber'] as const;

/**
 * Places an order from the customer's server cart. The delivery contact is either a saved
 * address (`addressId`) or typed in full (`addressName`, `houseNumber`, `phoneNumber`,
 * optional `contactName`), never both.
 */
export const placeOrderSchema = z
  .strictObject({
    fulfillmentPreference: z.enum(FULFILLMENT_PREFERENCES),
    paymentMethod: z.enum(PAYMENT_METHODS),
    addressId: uuidSchema.optional(),
    contactName: fullNameSchema.optional(),
    addressName: addressNameSchema.optional(),
    houseNumber: houseNumberSchema.optional(),
    phoneNumber: mobilePhoneSchema.optional(),
    /** Also keep a typed contact in the address book. */
    saveAddress: z.boolean().optional(),
    customerNote: z
      .string()
      .trim()
      .max(500, 'Note must be at most 500 characters')
      .transform((value) => value || undefined)
      .optional(),
    /** Only used for Chapa, when its initialize call needs an email. */
    payerEmail: z.email('Enter a valid email').max(254).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const typed = typedContactFields.filter((field) => value[field] !== undefined);
    if (value.addressId) {
      for (const field of typed) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: 'Choose a saved address or enter a new one, not both',
        });
      }
      return;
    }
    if (typed.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['addressId'], message: 'Choose or enter a delivery address' });
      return;
    }
    for (const field of ['addressName', 'houseNumber', 'phoneNumber'] as const) {
      if (value[field] === undefined) {
        ctx.addIssue({ code: 'custom', path: [field], message: 'This field is required' });
      }
    }
  });
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export interface CheckoutResult {
  order: CustomerOrder;
  /** Chapa hand-off; null for bank transfer. */
  chapa: { paymentId: string; checkoutUrl: string | null; initializationError: boolean } | null;
}
