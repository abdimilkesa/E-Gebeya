import type { Cart, CartLine, MergeCartResult } from '@marketplace/contracts';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useToast } from '../../components/ui/Toast';
import { api, errorMessage } from '../../lib/api';
import { pluralize } from '../../lib/format';
import { guestCart } from './guest-cart';

export type CartMode = 'guest' | 'customer' | 'unavailable';

interface CartContextValue {
  mode: CartMode;
  cart: Cart | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  itemCount: number;
  pending: boolean;
  addItem: (productId: string, quantity?: number) => Promise<boolean>;
  setQuantity: (line: CartLine, quantity: number) => Promise<void>;
  removeLines: (lines: CartLine[]) => Promise<void>;
  clear: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

const SERVER_CART_KEY = ['cart', 'server'] as const;
const EMPTY_CART: Cart = { id: null, shops: [], itemCount: 0, merchandiseSubtotal: '0.00', hasIssues: false };

/** Shared across StrictMode double effects so a guest cart is merged exactly once. */
let mergeInFlight: Promise<MergeCartResult | null> | null = null;

function mergeGuestCartOnce(): Promise<MergeCartResult | null> {
  mergeInFlight ??= (async () => {
    const items = guestCart.getLines();
    if (items.length === 0) return null;
    const result = await api.post<MergeCartResult>('/cart/merge', { items });
    guestCart.clear();
    return result;
  })().finally(() => {
    mergeInFlight = null;
  });
  return mergeInFlight;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [merging, setMerging] = useState(false);

  const mode: CartMode = !user ? 'guest' : user.role === 'CUSTOMER' ? 'customer' : 'unavailable';
  const guestLines = useSyncExternalStore(guestCart.subscribe, guestCart.getLines, () => []);

  const guestQuery = useQuery({
    queryKey: ['cart', 'guest', guestLines],
    queryFn: () => api.post<MergeCartResult>('/cart/preview', { items: guestLines }, { auth: false }),
    enabled: ready && mode === 'guest' && guestLines.length > 0,
    placeholderData: keepPreviousData,
  });

  const serverQuery = useQuery({
    queryKey: SERVER_CART_KEY,
    queryFn: () => api.get<Cart>('/cart'),
    enabled: ready && mode === 'customer' && !merging,
  });

  // Products that no longer exist are dropped from the browser cart.
  const rejectedIds = guestQuery.data?.rejected.map((line) => line.productId).join(',');
  useEffect(() => {
    if (rejectedIds) guestCart.remove(rejectedIds.split(','));
  }, [rejectedIds]);

  // After a customer signs in, their guest cart moves into the server cart.
  useEffect(() => {
    if (!ready || mode !== 'customer' || guestCart.getLines().length === 0) return;
    setMerging(true);
    mergeGuestCartOnce()
      .then((result) => {
        if (!result) return;
        queryClient.setQueryData(SERVER_CART_KEY, result);
        if (result.rejected.length > 0) {
          toast.info(`${pluralize(result.rejected.length, 'item')} from your basket could not be added because they are no longer available.`);
        }
      })
      .catch((error: unknown) => toast.error(errorMessage(error, 'Could not move your basket into your account.')))
      .finally(() => setMerging(false));
  }, [ready, mode, queryClient, toast]);

  const runServer = useCallback(
    async (action: () => Promise<Cart>) => {
      setPending(true);
      try {
        queryClient.setQueryData(SERVER_CART_KEY, await action());
      } finally {
        setPending(false);
      }
    },
    [queryClient],
  );

  const addItem = useCallback(
    async (productId: string, quantity = 1) => {
      try {
        if (mode === 'customer') {
          await runServer(() => api.post<Cart>('/cart/items', { productId, quantity }));
        } else if (mode === 'guest') {
          guestCart.add(productId, quantity);
        } else {
          toast.info('Shopping is available with a customer account.');
          return false;
        }
        toast.success('Added to cart');
        return true;
      } catch (error) {
        toast.error(errorMessage(error));
        return false;
      }
    },
    [mode, runServer, toast],
  );

  const setQuantity = useCallback(
    async (line: CartLine, quantity: number) => {
      try {
        if (mode === 'customer') {
          await runServer(() => api.patch<Cart>(`/cart/items/${line.id}`, { quantity }));
        } else {
          guestCart.setQuantity(line.productId, quantity);
        }
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
    [mode, runServer, toast],
  );

  const removeLines = useCallback(
    async (lines: CartLine[]) => {
      try {
        if (mode === 'customer') {
          for (const line of lines) {
            await runServer(() => api.delete<Cart>(`/cart/items/${line.id}`));
          }
        } else {
          guestCart.remove(lines.map((line) => line.productId));
        }
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
    [mode, runServer, toast],
  );

  const clear = useCallback(async () => {
    try {
      if (mode === 'customer') await runServer(() => api.delete<Cart>('/cart'));
      else guestCart.clear();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }, [mode, runServer, toast]);

  const value = useMemo<CartContextValue>(() => {
    if (mode === 'customer') {
      return {
        mode,
        cart: serverQuery.data,
        isLoading: !ready || merging || serverQuery.isPending,
        error: serverQuery.error,
        refetch: () => void serverQuery.refetch(),
        itemCount: serverQuery.data?.itemCount ?? 0,
        pending,
        addItem,
        setQuantity,
        removeLines,
        clear,
      };
    }
    const guestCount = guestLines.reduce((sum, line) => sum + line.quantity, 0);
    return {
      mode,
      cart: guestLines.length === 0 ? EMPTY_CART : guestQuery.data,
      isLoading: !ready || (guestLines.length > 0 && guestQuery.isPending),
      error: guestQuery.error,
      refetch: () => void guestQuery.refetch(),
      itemCount: mode === 'guest' ? guestCount : 0,
      pending: pending || guestQuery.isFetching,
      addItem,
      setQuantity,
      removeLines,
      clear,
    };
  }, [mode, ready, merging, serverQuery, guestQuery, guestLines, pending, addItem, setQuantity, removeLines, clear]);

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartContextValue {
  const context = use(CartContext);
  if (!context) throw new Error('useCart must be used inside <CartProvider>');
  return context;
}
