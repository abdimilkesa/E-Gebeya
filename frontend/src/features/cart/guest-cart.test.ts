import { MAX_CART_LINE_QUANTITY, MAX_CART_LINES } from '@marketplace/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { CartFullError, guestCart } from './guest-cart';

const STORAGE_KEY = 'cart_guest_v1';
const productId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('guest cart', () => {
  beforeEach(() => guestCart.clear());

  it('merges repeated adds of a product into one line, capped at the maximum quantity', () => {
    guestCart.add(productId(1), 2);
    guestCart.add(productId(2), 1);
    guestCart.add(productId(1), 3);
    expect(guestCart.getLines()).toEqual([
      { productId: productId(1), quantity: 5 },
      { productId: productId(2), quantity: 1 },
    ]);

    guestCart.add(productId(1), MAX_CART_LINE_QUANTITY);
    expect(guestCart.getLines()[0]?.quantity).toBe(MAX_CART_LINE_QUANTITY);
  });

  it('keeps an edited quantity between 1 and the maximum', () => {
    guestCart.add(productId(1), 4);
    guestCart.setQuantity(productId(1), 0);
    expect(guestCart.getLines()[0]?.quantity).toBe(1);
    guestCart.setQuantity(productId(1), 500);
    expect(guestCart.getLines()[0]?.quantity).toBe(MAX_CART_LINE_QUANTITY);
  });

  it('stores only product ids and quantities, and removes the key when emptied', () => {
    guestCart.add(productId(1), 2);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual([{ productId: productId(1), quantity: 2 }]);

    guestCart.remove(productId(1));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('refuses a new product once the cart holds the maximum number of lines', () => {
    for (let n = 1; n <= MAX_CART_LINES; n += 1) guestCart.add(productId(n), 1);
    expect(() => guestCart.add(productId(MAX_CART_LINES + 1), 1)).toThrow(CartFullError);

    guestCart.add(productId(1), 1);
    expect(guestCart.getLines()).toHaveLength(MAX_CART_LINES);
    expect(guestCart.getLines()[0]?.quantity).toBe(2);
  });

  it('discards tampered storage instead of trusting it', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ productId: 'not-an-id', quantity: -4, price: '0.01' }]));
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    expect(guestCart.getLines()).toEqual([]);
  });
});
