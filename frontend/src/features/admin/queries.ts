import type {
  AdminCategory,
  AdminCustomer,
  AdminMerchant,
  AdminMerchantDetail,
  AdminOverview,
  AdminShop,
  AuditLogEntry,
} from '@marketplace/contracts';
import { keepPreviousData, useQuery, type QueryClient } from '@tanstack/react-query';
import { api, type Query } from '../../lib/api';

export const adminKeys = {
  all: ['admin'] as const,
  overview: ['admin', 'overview'] as const,
  shops: (query: Query) => ['admin', 'shops', query] as const,
  shop: (id: string) => ['admin', 'shop', id] as const,
  merchants: (query: Query) => ['admin', 'merchants', query] as const,
  merchant: (id: string) => ['admin', 'merchant', id] as const,
  customers: (query: Query) => ['admin', 'customers', query] as const,
  categories: ['admin', 'categories'] as const,
  auditLogs: (query: Query) => ['admin', 'audit-logs', query] as const,
};

/** After any admin write: refresh admin screens and the public catalog that reflects them. */
export function invalidateAdminData(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: adminKeys.all });
  void queryClient.invalidateQueries({ queryKey: ['shops'] });
  void queryClient.invalidateQueries({ queryKey: ['shop'] });
  void queryClient.invalidateQueries({ queryKey: ['products'] });
  void queryClient.invalidateQueries({ queryKey: ['categories'] });
}

export const useAdminOverview = () =>
  useQuery({ queryKey: adminKeys.overview, queryFn: () => api.get<AdminOverview>('/admin/overview') });

export const useAdminShops = (query: Query) =>
  useQuery({
    queryKey: adminKeys.shops(query),
    queryFn: () => api.page<AdminShop>('/admin/shops', query),
    placeholderData: keepPreviousData,
  });

export const useAdminShop = (id: string | undefined) =>
  useQuery({
    queryKey: adminKeys.shop(id ?? ''),
    queryFn: () => api.get<AdminShop>(`/admin/shops/${id}`),
    enabled: !!id,
  });

export const useAdminMerchants = (query: Query) =>
  useQuery({
    queryKey: adminKeys.merchants(query),
    queryFn: () => api.page<AdminMerchant>('/admin/merchants', query),
    placeholderData: keepPreviousData,
  });

export const useAdminMerchant = (id: string | undefined) =>
  useQuery({
    queryKey: adminKeys.merchant(id ?? ''),
    queryFn: () => api.get<AdminMerchantDetail>(`/admin/merchants/${id}`),
    enabled: !!id,
  });

export const useAdminCustomers = (query: Query) =>
  useQuery({
    queryKey: adminKeys.customers(query),
    queryFn: () => api.page<AdminCustomer>('/admin/customers', query),
    placeholderData: keepPreviousData,
  });

export const useAdminCategories = () =>
  useQuery({ queryKey: adminKeys.categories, queryFn: () => api.get<AdminCategory[]>('/admin/categories') });

export const useAuditLogs = (query: Query) =>
  useQuery({
    queryKey: adminKeys.auditLogs(query),
    queryFn: () => api.page<AuditLogEntry>('/admin/audit-logs', query),
    placeholderData: keepPreviousData,
  });
