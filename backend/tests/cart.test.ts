import { describe, expect, it } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import { prisma } from '../src/lib/prisma.js';
import {
  api,
  bearer,
  createAndLogin,
  createCategory,
  createProduct,
  createShop,
  createUser,
} from './helpers.js';

/** Two shops with different delivery fees, as in a multi-vendor checkout. */
async function twoShopCatalog() {
  const merchantA = await createUser('MERCHANT');
  const merchantB = await createUser('MERCHANT');
  const shopA = await createShop(merchantA.id, {
    name: 'Shop A',
    deliveryFeeEtb: new Prisma.Decimal('50.00'),
  });
  const shopB = await createShop(merchantB.id, {
    name: 'Shop B',
    deliveryFeeEtb: new Prisma.Decimal('30.00'),
  });
  const category = await createCategory();
  const laptop = await createProduct(shopA.id, category.id, {
    name: 'Laptop',
    price: new Prisma.Decimal('30000.00'),
    stockQuantity: 5,
  });
  const mouse = await createProduct(shopA.id, category.id, {
    name: 'Mouse',
    price: new Prisma.Decimal('450.50'),
    stockQuantity: 20,
  });
  const coffee = await createProduct(shopB.id, category.id, {
    name: 'Coffee',
    price: new Prisma.Decimal('480.00'),
    stockQuantity: 2,
  });
  return { shopA, shopB, laptop, mouse, coffee };
}

describe('guest cart preview', () => {
  it('prices browser-held lines from the database and drops unknown products', async () => {
    const { laptop, coffee, shopA, shopB } = await twoShopCatalog();
    const response = await api()
      .post('/api/v1/cart/preview')
      .send({
        items: [
          { productId: laptop.id, quantity: 1 },
          { productId: coffee.id, quantity: 2 },
          { productId: laptop.id, quantity: 1 },
          { productId: '00000000-0000-4000-8000-000000000000', quantity: 1 },
        ],
      })
      .expect(200);
    const cart = response.body.data;
    expect(cart.shops.map((shop: { shopId: string }) => shop.shopId)).toEqual([shopA.id, shopB.id]);
    expect(cart.shops[0].items[0]).toMatchObject({ quantity: 2, unitPrice: '30000.00', lineTotal: '60000.00' });
    expect(cart.merchandiseSubtotal).toBe('60960.00');
    expect(cart.itemCount).toBe(4);
    expect(cart.rejected).toEqual([
      { productId: '00000000-0000-4000-8000-000000000000', reason: 'NOT_FOUND' },
    ]);
  });
});

describe('server cart', () => {
  it('adds, merges quantities, updates and removes lines', async () => {
    const { laptop, mouse } = await twoShopCatalog();
    const { token } = await createAndLogin('CUSTOMER');

    const empty = await api().get('/api/v1/cart').set(bearer(token)).expect(200);
    expect(empty.body.data).toMatchObject({ shops: [], itemCount: 0, merchandiseSubtotal: '0.00' });

    await api().post('/api/v1/cart/items').set(bearer(token)).send({ productId: mouse.id, quantity: 1 }).expect(200);
    const added = await api()
      .post('/api/v1/cart/items')
      .set(bearer(token))
      .send({ productId: mouse.id, quantity: 2 })
      .expect(200);
    const line = added.body.data.shops[0].items[0];
    expect(line).toMatchObject({ quantity: 3, lineTotal: '1351.50', canPurchase: true });

    const updated = await api()
      .patch(`/api/v1/cart/items/${line.id}`)
      .set(bearer(token))
      .send({ quantity: 1 })
      .expect(200);
    expect(updated.body.data.merchandiseSubtotal).toBe('450.50');

    await api().patch(`/api/v1/cart/items/${line.id}`).set(bearer(token)).send({ quantity: 0 }).expect(400);
    await api().post('/api/v1/cart/items').set(bearer(token)).send({ productId: laptop.id, quantity: 1 }).expect(200);

    const removed = await api().delete(`/api/v1/cart/items/${line.id}`).set(bearer(token)).expect(200);
    expect(removed.body.data.shops[0].items).toHaveLength(1);

    const cleared = await api().delete('/api/v1/cart').set(bearer(token)).expect(200);
    expect(cleared.body.data.shops).toEqual([]);
  });

  it('enforces stock and availability on the server', async () => {
    const { coffee } = await twoShopCatalog();
    const { token } = await createAndLogin('CUSTOMER');

    const tooMany = await api()
      .post('/api/v1/cart/items')
      .set(bearer(token))
      .send({ productId: coffee.id, quantity: 3 })
      .expect(422);
    expect(tooMany.body.error.code).toBe('BUSINESS_RULE');

    await prisma.product.update({ where: { id: coffee.id }, data: { isAvailable: false } });
    await api().post('/api/v1/cart/items').set(bearer(token)).send({ productId: coffee.id, quantity: 1 }).expect(422);

    await prisma.product.update({ where: { id: coffee.id }, data: { status: 'ARCHIVED' } });
    await api().post('/api/v1/cart/items').set(bearer(token)).send({ productId: coffee.id, quantity: 1 }).expect(404);
  });

  it('reflects live price and stock changes and flags problem lines', async () => {
    const { laptop, coffee } = await twoShopCatalog();
    const { token } = await createAndLogin('CUSTOMER');
    await api().post('/api/v1/cart/items').set(bearer(token)).send({ productId: laptop.id, quantity: 1 }).expect(200);
    await api().post('/api/v1/cart/items').set(bearer(token)).send({ productId: coffee.id, quantity: 2 }).expect(200);

    await prisma.product.update({ where: { id: laptop.id }, data: { price: new Prisma.Decimal('28000.00') } });
    await prisma.product.update({ where: { id: coffee.id }, data: { stockQuantity: 1 } });

    const cart = (await api().get('/api/v1/cart').set(bearer(token)).expect(200)).body.data;
    expect(cart.shops[0].items[0]).toMatchObject({ unitPrice: '28000.00', canPurchase: true });
    expect(cart.shops[1].items[0]).toMatchObject({ canPurchase: false, issue: 'INSUFFICIENT_STOCK' });
    expect(cart.hasIssues).toBe(true);
    // Lines with issues are excluded from totals.
    expect(cart.merchandiseSubtotal).toBe('28000.00');
  });

  it("returns 404 for another customer's cart line", async () => {
    const { mouse } = await twoShopCatalog();
    const owner = await createAndLogin('CUSTOMER');
    const other = await createAndLogin('CUSTOMER');
    const cart = await api()
      .post('/api/v1/cart/items')
      .set(bearer(owner.token))
      .send({ productId: mouse.id, quantity: 1 })
      .expect(200);
    const itemId = cart.body.data.shops[0].items[0].id;

    await api().patch(`/api/v1/cart/items/${itemId}`).set(bearer(other.token)).send({ quantity: 2 }).expect(404);
    await api().delete(`/api/v1/cart/items/${itemId}`).set(bearer(other.token)).expect(404);
  });

  it('merges a guest cart: sums quantities and rejects unavailable products', async () => {
    const { laptop, mouse, coffee } = await twoShopCatalog();
    const { token } = await createAndLogin('CUSTOMER');
    await api().post('/api/v1/cart/items').set(bearer(token)).send({ productId: mouse.id, quantity: 2 }).expect(200);
    await prisma.product.update({ where: { id: coffee.id }, data: { isAvailable: false } });

    const merged = await api()
      .post('/api/v1/cart/merge')
      .set(bearer(token))
      .send({
        items: [
          { productId: mouse.id, quantity: 3 },
          { productId: laptop.id, quantity: 1 },
          { productId: coffee.id, quantity: 1 },
        ],
      })
      .expect(200);
    expect(merged.body.data.rejected).toEqual([{ productId: coffee.id, reason: 'UNAVAILABLE' }]);
    const lines = merged.body.data.shops.flatMap((shop: { items: unknown[] }) => shop.items);
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: mouse.id, quantity: 5 }),
        expect.objectContaining({ productId: laptop.id, quantity: 1 }),
      ]),
    );
  });
});

describe('POST /checkout/quote', () => {
  it('adds each shop delivery fee for delivery and none for pickup', async () => {
    const { laptop, coffee } = await twoShopCatalog();
    const { token } = await createAndLogin('CUSTOMER');
    await api().post('/api/v1/cart/items').set(bearer(token)).send({ productId: laptop.id, quantity: 1 }).expect(200);
    await api().post('/api/v1/cart/items').set(bearer(token)).send({ productId: coffee.id, quantity: 2 }).expect(200);

    const delivery = await api()
      .post('/api/v1/checkout/quote')
      .set(bearer(token))
      .send({ fulfillmentPreference: 'DELIVERY' })
      .expect(200);
    expect(delivery.body.data).toMatchObject({
      currency: 'ETB',
      merchandiseSubtotal: '30960.00',
      deliveryFeeTotal: '80.00',
      grandTotal: '31040.00',
      canCheckout: true,
      issues: [],
    });
    expect(delivery.body.data.shops[0]).toMatchObject({ subtotal: '30000.00', deliveryFee: '50.00', total: '30050.00' });

    const pickup = await api()
      .post('/api/v1/checkout/quote')
      .set(bearer(token))
      .send({ fulfillmentPreference: 'PICKUP' })
      .expect(200);
    expect(pickup.body.data).toMatchObject({ deliveryFeeTotal: '0.00', grandTotal: '30960.00' });
  });

  it('blocks checkout when a line has an issue or the cart is empty', async () => {
    const { coffee } = await twoShopCatalog();
    const { token } = await createAndLogin('CUSTOMER');

    const empty = await api()
      .post('/api/v1/checkout/quote')
      .set(bearer(token))
      .send({ fulfillmentPreference: 'PICKUP' })
      .expect(200);
    expect(empty.body.data.canCheckout).toBe(false);

    await api().post('/api/v1/cart/items').set(bearer(token)).send({ productId: coffee.id, quantity: 2 }).expect(200);
    await prisma.shop.update({ where: { id: coffee.shopId }, data: { status: 'SUSPENDED' } });
    const blocked = await api()
      .post('/api/v1/checkout/quote')
      .set(bearer(token))
      .send({ fulfillmentPreference: 'DELIVERY' })
      .expect(200);
    expect(blocked.body.data).toMatchObject({ canCheckout: false, deliveryFeeTotal: '0.00' });
    expect(blocked.body.data.issues[0]).toMatchObject({ productId: coffee.id, issue: 'NOT_FOUND' });

    await api().post('/api/v1/checkout/quote').set(bearer(token)).send({ fulfillmentPreference: 'DRONE' }).expect(400);
  });
});
