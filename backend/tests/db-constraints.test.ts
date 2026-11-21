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

    const rows = await prisma.$queryRaw<
      { product_id: string }[]
    >`SELECT product_id FROM public_catalog_products`;
    expect(rows.map((row) => row.product_id)).toEqual([visible.id]);

    await prisma.user.update({ where: { id: merchant.id }, data: { status: 'SUSPENDED' } });
    const none = await prisma.$queryRaw<
      { product_id: string }[]
    >`SELECT product_id FROM public_catalog_products`;
    expect(none).toHaveLength(0);
  });

  it('the public catalog view has exactly the columns the AI document lists', async () => {
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'public_catalog_products'
      ORDER BY ordinal_position`;
    expect(columns.map((column) => column.column_name)).toEqual([
      'product_id',
      'name',
      'description',
      'price',
      'currency',
      'image_url',
      'in_stock',
      'category_name',
      'category_slug',
      'shop_id',
      'shop_name',
      'shop_slug',
      'shop_latitude',
      'shop_longitude',
      'address_text',
    ]);
  });

  it('in_stock follows the purchasability rule without exposing the stock count', async () => {
    const merchant = await createUser('MERCHANT');
    const shop = await createShop(merchant.id);
    const category = await createCategory();
    const retired = await createCategory('Retired', false);
    const buyable = await createProduct(shop.id, category.id, { stockQuantity: 3 });
    const soldOut = await createProduct(shop.id, category.id, { stockQuantity: 0 });
    const switchedOff = await createProduct(shop.id, category.id, { isAvailable: false });
    const inRetiredCategory = await createProduct(shop.id, retired.id);

    const rows = await prisma.$queryRaw<{ product_id: string; in_stock: boolean; currency: string }[]>`
      SELECT product_id, in_stock, currency FROM public_catalog_products`;
    const inStock = new Map(rows.map((row) => [row.product_id, row.in_stock]));
    expect(inStock.get(buyable.id)).toBe(true);
    expect(inStock.get(soldOut.id)).toBe(false);
    expect(inStock.get(switchedOff.id)).toBe(false);
    expect(inStock.get(inRetiredCategory.id)).toBe(false);
    expect(new Set(rows.map((row) => row.currency))).toEqual(new Set(['ETB']));
  });

  describe('orders and payments', () => {
    async function subOrder() {
      const customer = await createUser('CUSTOMER');
      const merchant = await createUser('MERCHANT');
      const shop = await createShop(merchant.id);
      const contact = { contactName: 'Hana', addressName: 'Jimma', houseNumber: '12', phoneNumber: '0911223344' };
      const amount = new Prisma.Decimal('100.00');
      const order = await prisma.order.create({
        data: {
          ...contact,
          orderNumber: 'ORD-TEST-0002',
          customerId: customer.id,
          fulfillmentPreference: 'PICKUP',
          paymentMethod: 'BANK_TRANSFER',
          paymentStatus: 'UNPAID',
          fulfillmentStatus: 'PENDING_PAYMENT',
          stockHoldState: 'HELD',
          merchandiseSubtotal: amount,
          deliveryFeeTotal: new Prisma.Decimal('0.00'),
          grandTotal: amount,
        },
      });
      const merchantOrder = await prisma.merchantOrder.create({
        data: {
          ...contact,
          orderId: order.id,
          shopId: shop.id,
          merchantId: merchant.id,
          shopNameSnapshot: shop.name,
          subtotal: amount,
          deliveryFee: new Prisma.Decimal('0.00'),
          total: amount,
          paymentStatus: 'PENDING',
          fulfillmentStatus: 'AWAITING_PAYMENT',
        },
      });
      return { customer, order, merchantOrder, amount };
    }

    it('rejects a Chapa payment tied to a sub-order and a bank payment without one', async () => {
      const { order, merchantOrder, amount } = await subOrder();
      await expect(
        prisma.payment.create({
          data: {
            orderId: order.id,
            merchantOrderId: merchantOrder.id,
            method: 'CHAPA',
            provider: 'CHAPA',
            status: 'PENDING',
            amount,
            txRef: 'tx-shape-1',
          },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.payment.create({
          data: { orderId: order.id, method: 'BANK_TRANSFER', provider: 'MANUAL', status: 'PENDING', amount },
        }),
      ).rejects.toThrow();
    });

    it('allows one open Chapa attempt per order', async () => {
      const { order, amount } = await subOrder();
      const attempt = { orderId: order.id, method: 'CHAPA', provider: 'CHAPA', amount } as const;
      await prisma.payment.create({ data: { ...attempt, status: 'PENDING', txRef: 'tx-open-1' } });
      await expect(
        prisma.payment.create({ data: { ...attempt, status: 'PROCESSING', txRef: 'tx-open-2' } }),
      ).rejects.toThrow();
      await prisma.payment.updateMany({ where: { txRef: 'tx-open-1' }, data: { status: 'FAILED' } });
      await prisma.payment.create({ data: { ...attempt, status: 'PENDING', txRef: 'tx-open-3' } });
    });

    it('allows one default address per customer', async () => {
      const { customer } = await subOrder();
      const address = { userId: customer.id, contactName: 'Hana', addressName: 'Jimma', houseNumber: '1', phoneNumber: '0911223344' };
      await prisma.customerAddress.create({ data: { ...address, isDefault: true } });
      await prisma.customerAddress.create({ data: { ...address, isDefault: false } });
      await expect(prisma.customerAddress.create({ data: { ...address, isDefault: true } })).rejects.toThrow();
    });
  });
});
