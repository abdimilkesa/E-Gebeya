import {
  MAX_CART_LINES,
  MAX_CART_LINE_QUANTITY,
  cartLineInputSchema,
  type CartLineInput,
} from '@marketplace/contracts';
import { z } from 'zod';

const STORAGE_KEY = 'cart_guest_v1';
const linesSchema = z.array(cartLineInputSchema).max(MAX_CART_LINES);

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: CartLineInput[] | undefined;

/** Only product ids and quantities are stored; prices always come from the server. */
function read(): CartLineInput[] {
  if (cache) return cache;
  try {
    const parsed = linesSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'));
    cache = parsed.success ? parsed.data : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(lines: CartLineInput[]) {
  cache = lines;
  try {
    if (lines.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Storage full or disabled (private mode): the cart still works for this page view.
  }
  for (const listener of listeners) listener();
}

if (typeof window !== 'undefined') {
  // Keep tabs in sync.
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      cache = undefined;
      for (const listener of listeners) listener();
    }
  });
}

export class CartFullError extends Error {
  constructor() {
    super(`Your cart can hold at most ${MAX_CART_LINES} different products.`);
  }
}

export const guestCart = {
  getLines: read,

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  add(productId: string, quantity: number) {
    const lines = read();
    const existing = lines.find((line) => line.productId === productId);
    if (!existing && lines.length >= MAX_CART_LINES) throw new CartFullError();
    write(
      existing
        ? lines.map((line) =>
            line.productId === productId
              ? { ...line, quantity: Math.min(line.quantity + quantity, MAX_CART_LINE_QUANTITY) }
              : line,
          )
        : [...lines, { productId, quantity: Math.min(quantity, MAX_CART_LINE_QUANTITY) }],
    );
  },

  setQuantity(productId: string, quantity: number) {
    write(
      read().map((line) =>
        line.productId === productId
          ? { ...line, quantity: Math.max(1, Math.min(quantity, MAX_CART_LINE_QUANTITY)) }
          : line,
      ),
    );
  },

  remove(productIds: string | string[]) {
    const ids = new Set(Array.isArray(productIds) ? productIds : [productIds]);
    write(read().filter((line) => !ids.has(line.productId)));
  },

  clear() {
    write([]);
  },
};
