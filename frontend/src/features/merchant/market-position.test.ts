import { describe, expect, it } from 'vitest';
import { compareWithMarket, type CatalogListing, type OwnListing } from './market-position';

const own = (overrides: Partial<OwnListing> = {}): OwnListing => ({
  id: 'own-1',
  name: 'cxcxv',
  price: '34.00',
  categorySlug: 'health-beauty',
  categoryName: 'Health & Beauty',
  ...overrides,
});

const listing = (overrides: Partial<CatalogListing> = {}): CatalogListing => ({
  id: 'other-1',
  name: 'Soap',
  price: '40.00',
  canPurchase: true,
  categorySlug: 'health-beauty',
  shopId: 'shop-b',
  shopName: 'Other Shop',
  ...overrides,
});

describe('compareWithMarket', () => {
  it('reports the only seller when no other shop sells in the category', () => {
    const [row] = compareWithMarket([own()], [listing({ id: 'own-1', shopId: 'shop-a', name: 'cxcxv', price: '34.00' })], ['shop-a']);
    expect(row).toBeDefined();
    expect(row).toMatchObject({
      position: 'only',
      otherCount: 0,
      averageOther: null,
      onTheMarket: true,
      shoppersCanBuy: true,
    });
  });

  it('does not average a single other price', () => {
    const [row] = compareWithMarket([own()], [listing()], ['shop-a']);
    expect(row).toBeDefined();
    expect(row?.position).toBe('one-other');
    expect(row?.averageOther).toBeNull();
    expect(row?.others).toEqual([{ name: 'Soap', shopName: 'Other Shop', price: '40.00' }]);
    expect(row?.onTheMarket).toBe(false);
  });

  it('places the merchant price against the average of two other buyable prices', () => {
    const catalog = [
      listing({ id: 'a', name: 'Soap', price: '20.00' }),
      listing({ id: 'b', name: 'Lotion', price: '80.00', shopId: 'shop-c', shopName: 'Third Shop' }),
      listing({ id: 'hidden', name: 'Out', price: '5.00', canPurchase: false, shopId: 'shop-d', shopName: 'Closed' }),
    ];
    const [row] = compareWithMarket([own({ price: '34.00' })], catalog, ['shop-a']);
    expect(row).toBeDefined();
    expect(row?.averageOther).toBe('50.00');
    expect(row?.position).toBe('below');
    expect(row?.otherCount).toBe(2);
  });
});
