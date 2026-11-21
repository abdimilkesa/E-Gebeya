import { z } from 'zod';
import { fullNameSchema } from './auth.js';
import { phoneSchema } from './common.js';
import type { ShopStatus } from './enums.js';

export const updateMerchantProfileSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    contactPhone: phoneSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');
export type UpdateMerchantProfileInput = z.input<typeof updateMerchantProfileSchema>;

export interface MerchantProfile {
  id: string;
  fullName: string;
  username: string;
  businessName: string | null;
  contactPhone: string | null;
  mustChangePassword: boolean;
}

export interface MerchantDashboard {
  shops: {
    id: string;
    name: string;
    slug: string;
    status: ShopStatus;
    /** False when the shop is hidden from customers (suspended shop or suspended account). */
    isPublic: boolean;
  }[];
  products: {
    total: number;
    active: number;
    archived: number;
    outOfStock: number;
    unavailable: number;
    lowStock: number;
  };
  lowStockProducts: { id: string; name: string; stockQuantity: number; shopName: string }[];
  recentProducts: { id: string; name: string; price: string; updatedAt: string }[];
}

/** Products with stock at or below this number are flagged on the merchant dashboard. */
export const LOW_STOCK_THRESHOLD = 5;
