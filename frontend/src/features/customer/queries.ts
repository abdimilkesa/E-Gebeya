import type { CustomerAddress, CustomerOrder, OrderSummary } from '@marketplace/contracts';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type Query } from '../../lib/api';

export const customerKeys = {
  all: ['customer'] as const,
  addresses: ['customer', 'addresses'] as const,
  orders: (query: Query) => ['customer', 'orders', query] as const,
  order: (id: string) => ['customer', 'order', id] as const,
};

export const useAddresses = () =>
  useQuery({
    queryKey: customerKeys.addresses,
    queryFn: () => api.get<CustomerAddress[]>('/customers/me/addresses'),
  });

export const useCustomerOrders = (query: Query) =>
  useQuery({
    queryKey: customerKeys.orders(query),
    queryFn: () => api.page<OrderSummary>('/orders', query),
    placeholderData: keepPreviousData,
  });

export const useCustomerOrder = (id: string | undefined) =>
  useQuery({
    queryKey: customerKeys.order(id ?? ''),
    queryFn: () => api.get<CustomerOrder>(`/orders/${id}`),
    enabled: !!id,
  });
