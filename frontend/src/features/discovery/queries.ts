import {
  MAX_MAP_SHOPS,
  type PublicCategory,
  type PublicProduct,
  type PublicProductDetail,
  type PublicShopDetail,
  type PublicShopSummary,
} from '@marketplace/contracts';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type Query } from '../../lib/api';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => api.get<PublicCategory[]>('/categories', undefined, signal),
    staleTime: 5 * 60_000,
  });
}

export interface ShopFilters {
  q?: string;
  product?: string;
  category?: string;
}

/** Every visible shop matching the filters, for drawing all pins at once. */
export function usePublicShops(filters: ShopFilters) {
  return useQuery({
    queryKey: ['shops', filters],
    queryFn: ({ signal }) =>
      api.page<PublicShopSummary>('/shops', { ...filters, pageSize: MAX_MAP_SHOPS }, signal),
    placeholderData: keepPreviousData,
  });
}

export function usePublicShop(slug: string | undefined) {
  return useQuery({
    queryKey: ['shop', slug],
    queryFn: ({ signal }) => api.get<PublicShopDetail>(`/shops/${encodeURIComponent(slug ?? '')}`, undefined, signal),
    enabled: !!slug,
  });
}

export function usePublicProducts(query: Query, enabled = true) {
  return useQuery({
    queryKey: ['products', query],
    queryFn: ({ signal }) => api.page<PublicProduct>('/products', query, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function usePublicProduct(productId: string | undefined) {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: ({ signal }) =>
      api.get<PublicProductDetail>(`/products/${encodeURIComponent(productId ?? '')}`, undefined, signal),
    enabled: !!productId,
  });
}

/** Opens the exact stored coordinates in Google Maps; works without an API key. */
export function googleMapsUrl(latitude: string, longitude: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
