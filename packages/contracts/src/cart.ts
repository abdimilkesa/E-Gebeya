import { z } from 'zod';
import { MAX_CART_LINES, MAX_CART_LINE_QUANTITY, uuidSchema } from './common.js';
import type { LineIssue } from './enums.js';

export const cartQuantitySchema = z.coerce
  .number({ error: 'Quantity must be a whole number' })
  .int('Quantity must be a whole number')
  .min(1, 'Quantity must be at least 1')
  .max(MAX_CART_LINE_QUANTITY, `Quantity cannot exceed ${MAX_CART_LINE_QUANTITY}`);

export const cartLineInputSchema = z.object({
  productId: uuidSchema,
  quantity: cartQuantitySchema,
});
export type CartLineInput = z.infer<typeof cartLineInputSchema>;

export const addCartItemSchema = cartLineInputSchema;
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({ quantity: cartQuantitySchema });
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

export const mergeCartSchema = z.object({
  items: z.array(cartLineInputSchema).min(1).max(MAX_CART_LINES),
});
export type MergeCartInput = z.infer<typeof mergeCartSchema>;

/** Prices a guest cart (held in the browser) against the live catalog. */
export const previewCartSchema = z.object({
  items: z.array(cartLineInputSchema).max(MAX_CART_LINES),
});
export type PreviewCartInput = z.infer<typeof previewCartSchema>;

export interface CartLine {
  /** Server cart item id; for a guest preview this equals the product id. */
  id: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  canPurchase: boolean;
  issue: LineIssue | null;
}

export interface CartShopGroup {
  shopId: string;
  shopName: string;
  shopSlug: string;
  items: CartLine[];
  subtotal: string;
}

export interface Cart {
  id: string | null;
  shops: CartShopGroup[];
  itemCount: number;
  merchandiseSubtotal: string;
  hasIssues: boolean;
}

export interface MergeCartResult extends Cart {
  rejected: { productId: string; reason: LineIssue }[];
}
