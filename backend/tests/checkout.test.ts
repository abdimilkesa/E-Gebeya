import { randomUUID } from 'node:crypto';
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

const contact = { addressName: 'Mentina, near the mosque', houseNumber: '12', phoneNumber: '0911000000' };
const bankCheckout = { fulfillmentPreference: 'PICKUP', paymentMethod: 'BANK_TRANSFER', ...contact } as const;

/** The specification's worked example: a laptop, shoes and a jacket from three shops. */
async function threeShopCatalog(deliveryFees: [string, string, string] = ['0.00', '0.00', '0.00']) {
  const category = await createCategory();
  const shops = [];
  for (const [index, name] of ['Shop A', 'Shop B', 'Shop C'].entries()) {
    const merchant = await createUser('MERCHANT');
    shops.push(
      await createShop(merchant.id, {
        name,
        deliveryFeeEtb: new Prisma.Decimal(deliveryFees[index] ?? '0.00'),
        bankAccountName: `${name} Owner`,
        bankAccountNumber: `100000000000${index}`,
      }),
    );
  }
  const [shopA, shopB, shopC] = shops as [(typeof shops)[0], (typeof shops)[0], (typeof shops)[0]];
  const laptop = await createProduct(shopA.id, category.id, {
    name: 'Laptop',
    price: new Prisma.Decimal('30000.00'),
    stockQuantity: 3,
  });
  const shoes = await createProduct(shopB.id, category.id, {
    name: 'Shoes',
    price: new Prisma.Decimal('2000.00'),
    stockQuantity: 5,
  });
  const jacket = await createProduct(shopC.id, category.id, {
    name: 'Jacket',
    price: new Prisma.Decimal('3000.00'),
    stockQuantity: 4,
  });
  return { category, shopA, shopB, shopC, laptop, shoes, jacket };
}

async function customerWithCart(lines: { productId: string; quantity: number }[]) {
  const customer = await createAndLogin('CUSTOMER', { fullName: 'Liya Bekele' });
  for (const line of lines) {
    await api().post('/api/v1/cart/items').set(bearer(customer.token)).send(line).expect(200);
  }
  return customer;
}

const checkout = (token: string, body: object, key: string = randomUUID()) =>
  api().post('/api/v1/checkout').set(bearer(token)).set('Idempotency-Key', key).send(body);

const stockOf = async (productId: string) =>
  (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity;

describe('POST /checkout', () => {
  it('splits the three-shop example into one parent order and three sub-orders', async () => {
    const { shopA, laptop, shoes, jacket } = await threeShopCatalog();
    const customer = await customerWithCart([
      { productId: laptop.id, quantity: 1 },
      { productId: shoes.id, quantity: 1 },
      { productId: jacket.id, quantity: 1 },
    ]);

    const response = await checkout(customer.token, bankCheckout).expect(201);
    const { order, chapa } = response.body.data;
    expect(chapa).toBeNull();
    expect(order.orderNumber).toMatch(/^ORD-\d{8}-\d{4,}$/);
    expect(order).toMatchObject({
      paymentMethod: 'BANK_TRANSFER',
      fulfillmentPreference: 'PICKUP',
      merchandiseSubtotal: '35000.00',
      deliveryFeeTotal: '0.00',
      grandTotal: '35000.00',
      paymentStatus: 'UNPAID',
      fulfillmentStatus: 'PENDING_PAYMENT',
      paymentAttempt: null,
      contact: { contactName: 'Liya Bekele', ...contact },
    });
    expect(order.merchantOrders.map((sub: { total: string }) => sub.total)).toEqual([
      '30000.00',
      '2000.00',
      '3000.00',
    ]);
    const shopAOrder = order.merchantOrders[0];
    expect(shopAOrder).toMatchObject({
      shopName: 'Shop A',
      shopSlug: shopA.slug,
      paymentStatus: 'PENDING',
      fulfillmentStatus: 'AWAITING_PAYMENT',
      items: [{ productName: 'Laptop', unitPrice: '30000.00', quantity: 1, lineTotal: '30000.00' }],
      bank: {
        bankName: shopA.bankName,
        accountName: 'Shop A Owner',
        accountNumber: shopA.bankAccountNumber,
        amount: '30000.00',
      },
      receipt: null,
    });

    // Bank-transfer stock is held for 48 hours.
    const holdHours = (Date.parse(order.holdExpiresAt) - Date.parse(order.createdAt)) / 3_600_000;
    expect(holdHours).toBeCloseTo(48, 1);

    // Database: one parent, three sub-orders, three items, one bank payment per sub-order.
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.merchantOrder.count()).toBe(3);
    expect(await prisma.orderItem.count()).toBe(3);
    const payments = await prisma.payment.findMany({ orderBy: { amount: 'desc' } });
    expect(payments.map((payment) => [payment.method, payment.status, payment.amount.toFixed(2)])).toEqual([
      ['BANK_TRANSFER', 'PENDING', '30000.00'],
      ['BANK_TRANSFER', 'PENDING', '3000.00'],
      ['BANK_TRANSFER', 'PENDING', '2000.00'],
    ]);
    expect(payments.every((payment) => payment.merchantOrderId !== null)).toBe(true);

    // Each sub-order belongs to the merchant who owned the shop, with only that shop's lines.
    const subOrders = await prisma.merchantOrder.findMany({ include: { items: true, shop: true } });
    for (const subOrder of subOrders) {
      expect(subOrder.merchantId).toBe(subOrder.shop.merchantId);
      expect(subOrder.items).toHaveLength(1);
    }

    expect([await stockOf(laptop.id), await stockOf(shoes.id), await stockOf(jacket.id)]).toEqual([2, 4, 3]);
    const cart = await api().get('/api/v1/cart').set(bearer(customer.token)).expect(200);
    expect(cart.body.data.itemCount).toBe(0);
  });

  it("adds each shop's delivery fee for delivery and none for pickup", async () => {
    const { laptop, shoes } = await threeShopCatalog(['50.00', '30.00', '0.00']);
    const delivery = await customerWithCart([
      { productId: laptop.id, quantity: 1 },
      { productId: shoes.id, quantity: 2 },
    ]);
    const { order } = (
      await checkout(delivery.token, { ...bankCheckout, fulfillmentPreference: 'DELIVERY' }).expect(201)
    ).body.data;
    expect(order).toMatchObject({ merchandiseSubtotal: '34000.00', deliveryFeeTotal: '80.00', grandTotal: '34080.00' });
    expect(order.merchantOrders.map((sub: { deliveryFee: string; total: string }) => [sub.deliveryFee, sub.total])).toEqual([
      ['50.00', '30050.00'],
      ['30.00', '4030.00'],
    ]);
    // The bank amount a shop receives includes its own delivery fee.
    expect(order.merchantOrders.map((sub: { bank: { amount: string } }) => sub.bank.amount)).toEqual([
      '30050.00',
      '4030.00',
    ]);

    const pickup = await customerWithCart([{ productId: laptop.id, quantity: 1 }]);
    const pickupOrder = (await checkout(pickup.token, bankCheckout).expect(201)).body.data.order;
    expect(pickupOrder).toMatchObject({ deliveryFeeTotal: '0.00', grandTotal: '30000.00' });
  });

  it('keeps two lines from the same shop in one sub-order', async () => {
    const { shopA, category, laptop } = await threeShopCatalog();
    const bag = await createProduct(shopA.id, category.id, { name: 'Laptop bag', price: new Prisma.Decimal('900.00') });
    const customer = await customerWithCart([
      { productId: laptop.id, quantity: 1 },
      { productId: bag.id, quantity: 2 },
    ]);
    const { order } = (await checkout(customer.token, bankCheckout).expect(201)).body.data;
    expect(order.merchantOrders).toHaveLength(1);
    expect(order.merchantOrders[0]).toMatchObject({ subtotal: '31800.00', total: '31800.00' });
    expect(order.merchantOrders[0].items.map((item: { productName: string }) => item.productName)).toEqual([
      'Laptop',
      'Laptop bag',
    ]);
  });

  it('fails the whole checkout when one line is out of stock, writing nothing', async () => {
    const { laptop, shoes, jacket } = await threeShopCatalog();
    const customer = await customerWithCart([
      { productId: laptop.id, quantity: 1 },
      { productId: shoes.id, quantity: 1 },
      { productId: jacket.id, quantity: 2 },
    ]);
    await prisma.product.update({ where: { id: jacket.id }, data: { stockQuantity: 1 } });

    const response = await checkout(customer.token, bankCheckout).expect(422);
    expect(response.body.error.code).toBe('BUSINESS_RULE');
    expect(response.body.error.message).toContain('Jacket');
    expect(response.body.error.details).toHaveLength(1);

    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.payment.count()).toBe(0);
    expect([await stockOf(laptop.id), await stockOf(shoes.id), await stockOf(jacket.id)]).toEqual([3, 5, 1]);
    const cart = await api().get('/api/v1/cart').set(bearer(customer.token)).expect(200);
    expect(cart.body.data.itemCount).toBe(4);
  });

  it('rejects lines that stopped being purchasable after they were added', async () => {
    const { laptop, shoes, jacket, shopB, category } = await threeShopCatalog();
    const customer = await customerWithCart([
      { productId: laptop.id, quantity: 1 },
      { productId: shoes.id, quantity: 1 },
      { productId: jacket.id, quantity: 1 },
    ]);
    // Shop B's merchant is suspended, the jacket is switched off and the category is retired.
    await prisma.user.update({ where: { id: shopB.merchantId }, data: { status: 'SUSPENDED' } });
    await prisma.product.update({ where: { id: jacket.id }, data: { isAvailable: false } });
    let response = await checkout(customer.token, bankCheckout).expect(422);
    expect(response.body.error.details.map((detail: { message: string }) => detail.message)).toEqual([
      'Shoes is no longer for sale.',
      'Jacket is currently unavailable.',
    ]);

    await prisma.user.update({ where: { id: shopB.merchantId }, data: { status: 'ACTIVE' } });
    await prisma.product.update({ where: { id: jacket.id }, data: { isAvailable: true } });
    await prisma.category.update({ where: { id: category.id }, data: { isActive: false } });
    response = await checkout(customer.token, bankCheckout).expect(422);
    expect(response.body.error.details).toHaveLength(3);
    expect(await prisma.order.count()).toBe(0);
  });

  it('charges the price at checkout and keeps item snapshots after later edits', async () => {
    const { laptop } = await threeShopCatalog();
    const customer = await customerWithCart([{ productId: laptop.id, quantity: 1 }]);
    await prisma.product.update({ where: { id: laptop.id }, data: { price: new Prisma.Decimal('28500.00') } });

    const { order } = (await checkout(customer.token, bankCheckout).expect(201)).body.data;
    expect(order.grandTotal).toBe('28500.00');

    await prisma.product.update({
      where: { id: laptop.id },
      data: { name: 'Laptop Pro', price: new Prisma.Decimal('40000.00') },
    });
    const detail = await api().get(`/api/v1/orders/${order.id}`).set(bearer(customer.token)).expect(200);
    expect(detail.body.data.merchantOrders[0].items[0]).toMatchObject({
      productName: 'Laptop',
      unitPrice: '28500.00',
      lineTotal: '28500.00',
    });
  });

  it('replays a repeated Idempotency-Key and refuses the same key with a different body', async () => {
    const { laptop, shoes } = await threeShopCatalog();
    const customer = await customerWithCart([
      { productId: laptop.id, quantity: 1 },
      { productId: shoes.id, quantity: 1 },
    ]);
    const key = randomUUID();
    const first = await checkout(customer.token, bankCheckout, key).expect(201);
    const replay = await checkout(customer.token, { ...bankCheckout }, key).expect(201);
    expect(replay.body.data.order.id).toBe(first.body.data.order.id);
    expect(await prisma.order.count()).toBe(1);
    expect(await stockOf(laptop.id)).toBe(2);

    const conflict = await checkout(customer.token, { ...bankCheckout, houseNumber: '99' }, key).expect(409);
    expect(conflict.body.error.code).toBe('CONFLICT');

    // Another customer may use the same key value for their own checkout.
    const other = await customerWithCart([{ productId: shoes.id, quantity: 1 }]);
    await checkout(other.token, bankCheckout, key).expect(201);
    expect(await prisma.order.count()).toBe(2);
  });

  it('sells the last units to exactly as many concurrent checkouts as there is stock', async () => {
    const { laptop, shoes } = await threeShopCatalog();
    await prisma.product.update({ where: { id: laptop.id }, data: { stockQuantity: 2 } });
    const customers = [];
    for (let index = 0; index < 5; index += 1) {
      // Mixed carts lock several rows, in the same id order for everyone.
      customers.push(
        await customerWithCart([
          { productId: shoes.id, quantity: 1 },
          { productId: laptop.id, quantity: 1 },
        ]),
      );
    }

    const results = await Promise.all(customers.map((customer) => checkout(customer.token, bankCheckout)));
    expect(results.map((result) => result.status).sort()).toEqual([201, 201, 422, 422, 422]);
    expect(await stockOf(laptop.id)).toBe(0);
    expect(await stockOf(shoes.id)).toBe(3);
    expect(await prisma.order.count()).toBe(2);
  });

  it('validates the request: key header, contact, payment method and unknown fields', async () => {
    const { laptop } = await threeShopCatalog();
    const customer = await customerWithCart([{ productId: laptop.id, quantity: 1 }]);

    await api().post('/api/v1/checkout').set(bearer(customer.token)).send(bankCheckout).expect(400);
    await checkout(customer.token, bankCheckout, 'short').expect(400);
    await checkout(customer.token, { ...bankCheckout, phoneNumber: '12345' }).expect(400);
    await checkout(customer.token, { fulfillmentPreference: 'PICKUP', paymentMethod: 'BANK_TRANSFER' }).expect(400);
    await checkout(customer.token, { ...bankCheckout, houseNumber: undefined }).expect(400);
    await checkout(customer.token, { ...bankCheckout, paymentStatus: 'PAID' }).expect(400);
    await checkout(customer.token, { ...bankCheckout, addressId: randomUUID() }).expect(400);
    await checkout(customer.token, { ...bankCheckout, paymentMethod: 'CASH' }).expect(400);

    // Chapa is a valid method but the provider integration is not enabled.
    const chapa = await checkout(customer.token, { ...bankCheckout, paymentMethod: 'CHAPA' }).expect(422);
    expect(chapa.body.error.message).toContain('Chapa');
    expect(await prisma.order.count()).toBe(0);
  });

  it('refuses an empty cart and non-customers', async () => {
    const customer = await createAndLogin('CUSTOMER');
    const empty = await checkout(customer.token, bankCheckout).expect(422);
    expect(empty.body.error.message).toBe('Your cart is empty.');

    const merchant = await createAndLogin('MERCHANT');
    await checkout(merchant.token, bankCheckout).expect(403);
    await api().post('/api/v1/checkout').set('Idempotency-Key', randomUUID()).send(bankCheckout).expect(401);
  });

  it('uses a saved address by id, and can save a typed one', async () => {
    const { laptop, shoes } = await threeShopCatalog();
    const customer = await customerWithCart([{ productId: laptop.id, quantity: 1 }]);
    const saved = await api()
      .post('/api/v1/customers/me/addresses')
      .set(bearer(customer.token))
      .send({ contactName: 'Abebe Kebede', addressName: 'Hermata', houseNumber: 'H-7', phoneNumber: '0722334455' })
      .expect(201);

    const { order } = (
      await checkout(customer.token, {
        fulfillmentPreference: 'DELIVERY',
        paymentMethod: 'BANK_TRANSFER',
        addressId: saved.body.data.id,
      }).expect(201)
    ).body.data;
    expect(order.contact).toEqual({
      contactName: 'Abebe Kebede',
      addressName: 'Hermata',
      houseNumber: 'H-7',
      phoneNumber: '0722334455',
    });

    // Another customer's address id is not found.
    const intruder = await customerWithCart([{ productId: shoes.id, quantity: 1 }]);
    await checkout(intruder.token, bankCheckout).expect(201);
    await api().post('/api/v1/cart/items').set(bearer(intruder.token)).send({ productId: shoes.id, quantity: 1 });
    await checkout(intruder.token, {
      fulfillmentPreference: 'PICKUP',
      paymentMethod: 'BANK_TRANSFER',
      addressId: saved.body.data.id,
    }).expect(404);

    // A typed contact is saved once, even when used again.
    await api().post('/api/v1/cart/items').set(bearer(intruder.token)).send({ productId: shoes.id, quantity: 1 });
    await checkout(intruder.token, { ...bankCheckout, saveAddress: true }).expect(201);
    await api().post('/api/v1/cart/items').set(bearer(intruder.token)).send({ productId: shoes.id, quantity: 1 });
    await checkout(intruder.token, { ...bankCheckout, saveAddress: true }).expect(201);
    const book = await api().get('/api/v1/customers/me/addresses').set(bearer(intruder.token)).expect(200);
    expect(book.body.data).toHaveLength(1);
    expect(book.body.data[0]).toMatchObject({ ...contact, isDefault: true });
  });

  it('reports the accepted payment methods in the quote', async () => {
    const { laptop } = await threeShopCatalog();
    const customer = await customerWithCart([{ productId: laptop.id, quantity: 1 }]);
    const quote = await api()
      .post('/api/v1/checkout/quote')
      .set(bearer(customer.token))
      .send({ fulfillmentPreference: 'PICKUP' })
      .expect(200);
    expect(quote.body.data.paymentMethods).toEqual(['BANK_TRANSFER']);
  });
});

describe('customer orders', () => {
  it('lists only the caller’s orders and hides other customers’ orders as not found', async () => {
    const { laptop, shoes, jacket } = await threeShopCatalog();
    const liya = await customerWithCart([
      { productId: laptop.id, quantity: 1 },
      { productId: shoes.id, quantity: 1 },
    ]);
    const liyaOrder = (await checkout(liya.token, bankCheckout).expect(201)).body.data.order;
    await api().post('/api/v1/cart/items').set(bearer(liya.token)).send({ productId: jacket.id, quantity: 1 });
    await checkout(liya.token, bankCheckout).expect(201);

    const other = await customerWithCart([{ productId: jacket.id, quantity: 1 }]);
    await checkout(other.token, bankCheckout).expect(201);

    const list = await api().get('/api/v1/orders').set(bearer(liya.token)).expect(200);
    expect(list.body.meta.total).toBe(2);
    expect(list.body.data[1]).toMatchObject({
      id: liyaOrder.id,
      orderNumber: liyaOrder.orderNumber,
      grandTotal: '32000.00',
      paymentMethod: 'BANK_TRANSFER',
      paymentStatus: 'UNPAID',
      fulfillmentStatus: 'PENDING_PAYMENT',
      merchantOrderCount: 2,
    });
    const filtered = await api().get('/api/v1/orders?paymentStatus=PAID').set(bearer(liya.token)).expect(200);
    expect(filtered.body.meta.total).toBe(0);

    await api().get(`/api/v1/orders/${liyaOrder.id}`).set(bearer(other.token)).expect(404);
    await api().get('/api/v1/orders/not-a-uuid').set(bearer(liya.token)).expect(404);
    const merchant = await createAndLogin('MERCHANT');
    await api().get(`/api/v1/orders/${liyaOrder.id}`).set(bearer(merchant.token)).expect(403);
    await api().get('/api/v1/orders').expect(401);
  });
});
