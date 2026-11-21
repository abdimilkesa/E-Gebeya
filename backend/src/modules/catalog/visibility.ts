import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Single definition of "customers can see this". A shop is public when it is ACTIVE and
 * its merchant account is ACTIVE; a product is public when it is ACTIVE in a public shop.
 * The `public_catalog_products` SQL view applies the same rule for raw search queries.
 */
export const publicShopWhere = {
  status: 'ACTIVE',
  merchant: { status: 'ACTIVE' },
} satisfies Prisma.ShopWhereInput;

export const publicProductWhere = {
  status: 'ACTIVE',
  shop: publicShopWhere,
} satisfies Prisma.ProductWhereInput;

export function isShopPublic(shop: { status: string; merchant: { status: string } }): boolean {
  return shop.status === 'ACTIVE' && shop.merchant.status === 'ACTIVE';
}

/** Purchasable now: visible, switched on by the merchant, and in stock. */
export function canPurchase(product: { isAvailable: boolean; stockQuantity: number }): boolean {
  return product.isAvailable && product.stockQuantity > 0;
}
