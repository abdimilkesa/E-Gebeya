import { z } from 'zod';
import { fullNameSchema, passwordSchema, usernameSchema } from './auth.js';
import { paginationQuerySchema, phoneSchema } from './common.js';
import type { ShopStatus, UserStatus } from './enums.js';

export const createMerchantSchema = z.object({
  fullName: fullNameSchema,
  username: usernameSchema,
  /** Optional: when omitted the server generates a strong temporary password. */
  temporaryPassword: passwordSchema.optional(),
  contactPhone: phoneSchema,
  businessName: z.string().trim().min(2).max(160).optional(),
});
export type CreateMerchantInput = z.input<typeof createMerchantSchema>;

export const updateMerchantSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    contactPhone: phoneSchema.optional(),
    businessName: z.string().trim().min(2).max(160).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');
export type UpdateMerchantInput = z.input<typeof updateMerchantSchema>;

export const resetPasswordSchema = z.object({
  temporaryPassword: passwordSchema.optional(),
});
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

export const userStatusUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
});
export type UserStatusUpdateInput = z.infer<typeof userStatusUpdateSchema>;

export const adminUsersQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

export const adminShopsQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REMOVED']).optional(),
  merchantId: z.uuid().optional(),
});
export type AdminShopsQuery = z.infer<typeof adminShopsQuerySchema>;

export const auditLogsQuerySchema = paginationQuerySchema.extend({
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(40).optional(),
  entityId: z.uuid().optional(),
});
export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;

export interface AdminMerchant {
  id: string;
  fullName: string;
  username: string;
  status: UserStatus;
  mustChangePassword: boolean;
  businessName: string | null;
  contactPhone: string | null;
  shopCount: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminMerchantDetail extends AdminMerchant {
  shops: { id: string; name: string; slug: string; status: ShopStatus }[];
}

/** Returned once, when a merchant is created or their password is reset. */
export interface TemporaryCredentials {
  id: string;
  username: string;
  temporaryPassword: string;
  mustChangePassword: true;
}

export interface AdminCustomer {
  id: string;
  fullName: string;
  username: string;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminOverview {
  shops: { total: number; active: number; suspended: number; removed: number };
  merchants: { total: number; active: number; suspended: number; pendingPasswordChange: number };
  customers: { total: number; active: number; suspended: number };
  products: { total: number; active: number; archived: number; outOfStock: number };
  categories: { total: number; active: number };
  recentShops: {
    id: string;
    name: string;
    slug: string;
    status: ShopStatus;
    merchantUsername: string;
    createdAt: string;
  }[];
}

export interface AuditLogEntry {
  id: string;
  actor: { id: string; username: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}
