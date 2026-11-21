import { describe, expect, it } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import { prisma } from '../src/lib/prisma.js';
import { createCategory, createProduct, createShop, createUser } from './helpers.js';

/**
 * The database is the last line of defence: these checks hold even if a future code path
 * forgets to validate.
 */
describe('database constraints', () => {
  it('rejects impossible catalog values', async () => {
    const merchant = await createUser('MERCHANT');
    const shop = await createShop(merchant.id);
    const category = await createCategory();

    await expect(createProduct(shop.id, category.id, { price: new Prisma.Decimal('0') })).rejects.toThrow();
    await expect(createProduct(shop.id, category.id, { stockQuantity: -1 })).rejects.toThrow();
    await expect(
      createShop(merchant.id, { latitude: new Prisma.Decimal('95.000000') }),
    ).rejects.toThrow();
    await expect(
      createShop(merchant.id, { deliveryFeeEtb: new Prisma.Decimal('-1.00') }),
    ).rejects.toThrow();
  });

  it('rejects uppercase usernames and out-of-range cart quantities', async () => {
    await expect(createUser('CUSTOMER', { username: 'NotLower' })).rejects.toThrow();

    const customer = await createUser('CUSTOMER');
    const merchant = await createUser('MERCHANT');
    const product = await createProduct((await createShop(merchant.id)).id, (await createCategory()).id);
    const cart = await prisma.cart.create({ data: { userId: customer.id } });
    await expect(
      prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity: 100 } }),
    ).rejects.toThrow();
  });

  it('keeps order totals arithmetically consistent', async () => {
    const customer = await createUser('CUSTOMER');
    const base = {
      orderNumber: 'ORD-TEST-0001',
      customerId: customer.id,
      fulfillmentPreference: 'PICKUP' as const,
      contactName: 'Hana',
      addressName: 'Jimma',
      houseNumber: '12',
      phoneNumber: '0911223344',
      paymentMethod: 'BANK_TRANSFER' as const,
      paymentStatus: 'UNPAID' as const,
      fulfillmentStatus: 'PENDING_PAYMENT' as const,
      stockHoldState: 'HELD' as const,
      merchandiseSubtotal: new Prisma.Decimal('100.00'),
      deliveryFeeTotal: new Prisma.Decimal('20.00'),
    };
    await expect(
      prisma.order.create({ data: { ...base, grandTotal: new Prisma.Decimal('999.00') } }),
    ).rejects.toThrow();
    await prisma.order.create({ data: { ...base, grandTotal: new Prisma.Decimal('120.00') } });
  });

  it('the public catalog view hides archived products and hidden shops', async () => {
    const merchant = await createUser('MERCHANT');
    const category = await createCategory();
    const shop = await createShop(merchant.id);
    const hiddenShop = await createShop(merchant.id, { status: 'REMOVED' });
    const visible = await createProduct(shop.id, category.id);
    await createProduct(shop.id, category.id, { status: 'ARCHIVED' });
    await createProduct(hiddenShop.id, category.id);

    const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM public_catalog_products`;
    expect(rows.map((row) => row.id)).toEqual([visible.id]);

    await prisma.user.update({ where: { id: merchant.id }, data: { status: 'SUSPENDED' } });
    const none = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM public_catalog_products`;
    expect(none).toHaveLength(0);
  });
});
