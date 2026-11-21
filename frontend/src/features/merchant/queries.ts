import type { ManagedShop, MerchantDashboard, MerchantProduct, MerchantProfile } from '@marketplace/contracts';
import { keepPreviousData, useQuery, type QueryClient } from '@tanstack/react-query';
import { api, type Query } from '../../lib/api';

export const merchantKeys = {
  all: ['merchant'] as const,
  dashboard: ['merchant', 'dashboard'] as const,
  shops: ['merchant', 'shops'] as const,
  products: (query: Query) => ['merchant', 'products', query] as const,
  product: (id: string) => ['merchant', 'product', id] as const,
  profile: ['merchant', 'profile'] as const,
};

/** After a product change: refresh merchant screens and the public catalog. */
export function invalidateMerchantData(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: merchantKeys.all });
  void queryClient.invalidateQueries({ queryKey: ['products'] });
  void queryClient.invalidateQueries({ queryKey: ['product'] });
  void queryClient.invalidateQueries({ queryKey: ['shops'] });
  void queryClient.invalidateQueries({ queryKey: ['shop'] });
}

export const useMerchantDashboard = () =>
  useQuery({ queryKey: merchantKeys.dashboard, queryFn: () => api.get<MerchantDashboard>('/merchant/dashboard') });

export const useMerchantShops = () =>
  useQuery({ queryKey: merchantKeys.shops, queryFn: () => api.get<ManagedShop[]>('/merchant/shops') });

export const useMerchantProducts = (query: Query) =>
  useQuery({
    queryKey: merchantKeys.products(query),
    queryFn: () => api.page<MerchantProduct>('/merchant/products', query),
    placeholderData: keepPreviousData,
  });

export const useMerchantProduct = (id: string | undefined) =>
  useQuery({
    queryKey: merchantKeys.product(id ?? ''),
    queryFn: () => api.get<MerchantProduct>(`/merchant/products/${id}`),
    enabled: !!id,
  });

export const useMerchantProfile = () =>
  useQuery({ queryKey: merchantKeys.profile, queryFn: () => api.get<MerchantProfile>('/merchant/profile') });
