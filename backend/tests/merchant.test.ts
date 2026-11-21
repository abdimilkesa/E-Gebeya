import { MAX_UPLOAD_BYTES } from '@marketplace/contracts';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import {
  PNG_1PX,
  api,
  bearer,
  createAndLogin,
  createCategory,
  createMerchantWithShop,
  createProduct,
  createShop,
} from './helpers.js';

function uploadImage(token: string, buffer: Buffer = PNG_1PX, filename = 'photo.png') {
  return api()
    .post('/api/v1/merchant/uploads/images')
    .set(bearer(token))
    .attach('image', buffer, { filename, contentType: 'image/png' });
}

describe('merchant product management', () => {
  it('creates a product in the only shop, with images, and lists it', async () => {
    const { merchant, shop, category } = await createMerchantWithShop();
    const image = await uploadImage(merchant.token).expect(201);

    const created = await api()
      .post('/api/v1/merchant/products')
      .set(bearer(merchant.token))
      .send({
        categoryId: category.id,
        name: 'Laptop',
        description: '14 inch laptop',
        price: '30000',
        stockQuantity: 5,
        images: [{ publicId: image.body.data.publicId }],
      })
      .expect(201);
    expect(created.body.data).toMatchObject({
      shopId: shop.id,
      name: 'Laptop',
      price: '30000.00',
      stockQuantity: 5,
      isAvailable: true,
      status: 'ACTIVE',
      imageUrl: image.body.data.url,
    });

    const list = await api().get('/api/v1/merchant/products').set(bearer(merchant.token)).expect(200);
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0].id).toBe(created.body.data.id);
  });

  it('requires a shop choice when the merchant owns several shops', async () => {
    const { merchant, category } = await createMerchantWithShop();
    await createShop(merchant.user.id);
    const response = await api()
      .post('/api/v1/merchant/products')
      .set(bearer(merchant.token))
      .send({ categoryId: category.id, name: 'Tea', description: 'Black tea', price: '50', stockQuantity: 1 })
      .expect(400);
    expect(response.body.error.details[0].field).toBe('shopId');
  });

  it('validates price, stock and category', async () => {
    const { merchant, category } = await createMerchantWithShop();
    const inactive = await createCategory('Old', false);
    const base = { categoryId: category.id, name: 'Tea', description: 'Black tea', stockQuantity: 1 };
    for (const price of ['0', '-1', '12.345', 'abc']) {
      await api()
        .post('/api/v1/merchant/products')
        .set(bearer(merchant.token))
        .send({ ...base, price })
        .expect(400);
    }
    await api()
      .post('/api/v1/merchant/products')
      .set(bearer(merchant.token))
      .send({ ...base, price: '10', stockQuantity: -1 })
      .expect(400);
    await api()
      .post('/api/v1/merchant/products')
      .set(bearer(merchant.token))
      .send({ ...base, price: '10', categoryId: inactive.id })
      .expect(400);
  });

  it('updates price, stock and availability, and archive/restore control public visibility', async () => {
    const { merchant, shop, category } = await createMerchantWithShop();
    const product = await createProduct(shop.id, category.id);

    const updated = await api()
      .patch(`/api/v1/merchant/products/${product.id}`)
      .set(bearer(merchant.token))
      .send({ price: '120.50', stockQuantity: 0 })
      .expect(200);
    expect(updated.body.data).toMatchObject({ price: '120.50', stockQuantity: 0 });

    const publicView = await api().get(`/api/v1/products/${product.id}`).expect(200);
    expect(publicView.body.data).toMatchObject({ price: '120.50', canPurchase: false });
    expect(publicView.body.data).not.toHaveProperty('stockQuantity');

    await api()
      .delete(`/api/v1/merchant/products/${product.id}`)
      .set(bearer(merchant.token))
      .expect(200);
    await api().get(`/api/v1/products/${product.id}`).expect(404);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).status).toBe('ARCHIVED');

    await api()
      .post(`/api/v1/merchant/products/${product.id}/restore`)
      .set(bearer(merchant.token))
      .expect(200);
    await api().get(`/api/v1/products/${product.id}`).expect(200);
  });
});

describe('merchant isolation', () => {
  it("cannot read, edit, archive or add to another merchant's catalog", async () => {
    const a = await createMerchantWithShop();
    const b = await createAndLogin('MERCHANT');
    const product = await createProduct(a.shop.id, a.category.id);

    await api().get(`/api/v1/merchant/products/${product.id}`).set(bearer(b.token)).expect(404);
    await api()
      .patch(`/api/v1/merchant/products/${product.id}`)
      .set(bearer(b.token))
      .send({ price: '1' })
      .expect(404);
    await api().delete(`/api/v1/merchant/products/${product.id}`).set(bearer(b.token)).expect(404);
    await api()
      .post('/api/v1/merchant/products')
      .set(bearer(b.token))
      .send({
        shopId: a.shop.id,
        categoryId: a.category.id,
        name: 'Intruder',
        description: 'x',
        price: '1',
        stockQuantity: 1,
      })
      .expect(404);

    const list = await api().get('/api/v1/merchant/products').set(bearer(b.token)).expect(200);
    expect(list.body.data).toHaveLength(0);
    const shops = await api().get('/api/v1/merchant/shops').set(bearer(b.token)).expect(200);
    expect(shops.body.data).toHaveLength(0);

    const untouched = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(untouched.price.toFixed(2)).toBe('100.00');
    expect(untouched.status).toBe('ACTIVE');
  });

  it('loses access to a shop once the admin removes it, but keeps it while suspended', async () => {
    const { merchant, shop, category } = await createMerchantWithShop();
    const product = await createProduct(shop.id, category.id);

    await prisma.shop.update({ where: { id: shop.id }, data: { status: 'SUSPENDED' } });
    await api().get(`/api/v1/merchant/products/${product.id}`).set(bearer(merchant.token)).expect(200);
    const dashboard = await api().get('/api/v1/merchant/dashboard').set(bearer(merchant.token)).expect(200);
    expect(dashboard.body.data.shops[0]).toMatchObject({ id: shop.id, isPublic: false });

    await prisma.shop.update({ where: { id: shop.id }, data: { status: 'REMOVED' } });
    await api().get(`/api/v1/merchant/products/${product.id}`).set(bearer(merchant.token)).expect(404);
  });

  it('shows bank details only to the owning merchant', async () => {
    const { merchant, shop } = await createMerchantWithShop();
    const own = await api().get('/api/v1/merchant/shops').set(bearer(merchant.token)).expect(200);
    expect(own.body.data[0]).toMatchObject({ id: shop.id, bankAccountNumber: '1000000000001' });
    const publicShop = await api().get(`/api/v1/shops/${shop.slug}`).expect(200);
    expect(JSON.stringify(publicShop.body)).not.toContain('1000000000001');
  });
});

describe('image uploads', () => {
  it('accepts real images and rejects disguised or oversized files', async () => {
    const { merchant } = await createMerchantWithShop();
    const ok = await uploadImage(merchant.token).expect(201);
    expect(ok.body.data.url).toMatch(/^\/uploads\/products\/.+\.png$/);
    await api().get(ok.body.data.url).expect(200).expect('Content-Type', /image\/png/);

    const disguised = await uploadImage(merchant.token, Buffer.from('<script>alert(1)</script>'), 'x.png').expect(400);
    expect(disguised.body.error.code).toBe('VALIDATION_ERROR');

    const huge = Buffer.concat([PNG_1PX, Buffer.alloc(MAX_UPLOAD_BYTES)]);
    const tooBig = await uploadImage(merchant.token, huge).expect(413);
    expect(tooBig.body.error.code).toBe('PAYLOAD_TOO_LARGE');

    await api().post('/api/v1/merchant/uploads/images').set(bearer(merchant.token)).expect(400);
  });

  it('rejects image ids the server did not issue', async () => {
    const { merchant, category } = await createMerchantWithShop();
    await api()
      .post('/api/v1/merchant/products')
      .set(bearer(merchant.token))
      .send({
        categoryId: category.id,
        name: 'Tea',
        description: 'Black tea',
        price: '50',
        stockQuantity: 1,
        images: [{ publicId: 'products/00000000-0000-4000-8000-000000000000.png' }],
      })
      .expect(400);
  });
});
