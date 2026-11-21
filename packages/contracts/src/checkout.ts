import { z } from 'zod';
import { FULFILLMENT_PREFERENCES } from './enums.js';
import type { FulfillmentPreference, LineIssue } from './enums.js';

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
}
