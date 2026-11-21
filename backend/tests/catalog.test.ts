import { describe, expect, it } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import { prisma } from '../src/lib/prisma.js';
import { api, createCategory, createProduct, createShop, createUser } from './helpers.js';

describe('GET /shops (map data)', () => {
  it('returns only active shops of active merchants, without bank details', async () => {
    const merchant = await createUser('MERCHANT');
    const suspendedMerchant = await createUser('MERCHANT', { status: 'SUSPENDED' });
    const visible = await createShop(merchant.id, { name: 'Visible Shop' });
    await createShop(merchant.id, { status: 'SUSPENDED' });
    await createShop(merchant.id, { status: 'REMOVED' });
    await createShop(suspendedMerchant.id);

    const response = await api().get('/api/v1/shops').expect(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: visible.id,
      name: 'Visible Shop',
      latitude: '7.666700',
      longitude: '36.833300',
      productCount: 0,
    });
    expect(response.body.meta).toMatchObject({ total: 1, page: 1 });
    const text = JSON.stringify(response.body);
    for (const secret of ['bankAccountNumber', 'bankName', '1000000000001']) {
      expect(text).not.toContain(secret);
    }
  });

  it('filters by bounding box, name, product text and category', async () => {
    const merchant = await createUser('MERCHANT');
    const coffee = await createCategory('Coffee');
    const center = await createShop(merchant.id, { name: 'Center Coffee' });
    await createShop(merchant.id, {
      name: 'Far Away Shop',
      latitude: new Prisma.Decimal('9.030000'),
      longitude: new Prisma.Decimal('38.740000'),
    });
    await createProduct(center.id, coffee.id, { name: 'Roasted beans' });

    const box = await api()
      .get('/api/v1/shops?swLat=7.6&swLng=36.8&neLat=7.7&neLng=36.9')
      .expect(200);
    expect(box.body.data.map((shop: { id: string }) => shop.id)).toEqual([center.id]);

    const byName = await api().get('/api/v1/shops?q=far').expect(200);
    expect(byName.body.data[0].name).toBe('Far Away Shop');

    const byProduct = await api().get('/api/v1/shops?product=beans').expect(200);
    expect(byProduct.body.data.map((shop: { id: string }) => shop.id)).toEqual([center.id]);

    const byCategory = await api().get(`/api/v1/shops?category=${coffee.slug}`).expect(200);
    expect(byCategory.body.data).toHaveLength(1);
    expect(byCategory.body.data[0].categories[0]).toMatchObject({ slug: coffee.slug });

    const partial = await api().get('/api/v1/shops?swLat=7.6&swLng=36.8').expect(400);
    expect(partial.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns a shop profile by slug and 404 for hidden shops', async () => {
    const merchant = await createUser('MERCHANT');
    const shop = await createShop(merchant.id, { description: 'Fresh coffee' });
    const hidden = await createShop(merchant.id, { status: 'SUSPENDED' });

    const response = await api().get(`/api/v1/shops/${shop.slug}`).expect(200);
    expect(response.body.data).toMatchObject({
      description: 'Fresh coffee',
      phone: '0471112233',
      deliveryFeeEtb: '50.00',
    });
    await api().get(`/api/v1/shops/${hidden.slug}`).expect(404);
    await api().get('/api/v1/shops/Not_A_Slug!').expect(404);
  });
});

describe('GET /products (search)', () => {
  async function catalog() {
    const merchant = await createUser('MERCHANT');
    const shop = await createShop(merchant.id);
    const hiddenShop = await createShop(merchant.id, { status: 'SUSPENDED' });
    const electronics = await createCategory('Electronics');
    const coffee = await createCategory('Coffee');
    const phone = await createProduct(shop.id, electronics.id, {
      name: 'Smartphone',
      price: new Prisma.Decimal('14500.00'),
    });
    const charger = await createProduct(shop.id, electronics.id, {
      name: 'Phone charger',
      price: new Prisma.Decimal('650.00'),
      stockQuantity: 0,
    });
    const beans = await createProduct(shop.id, coffee.id, {
      name: 'Coffee beans',
      price: new Prisma.Decimal('480.00'),
      isAvailable: false,
    });
    await createProduct(shop.id, coffee.id, { name: 'Archived phone', status: 'ARCHIVED' });
    await createProduct(hiddenShop.id, coffee.id, { name: 'Hidden phone' });
    return { shop, electronics, coffee, phone, charger, beans };
  }

  it('lists visible products with canPurchase and no stock counts', async () => {
    const { phone, charger, beans } = await catalog();
    const response = await api().get('/api/v1/products').expect(200);
    const byId = new Map(
      response.body.data.map((product: { id: string; canPurchase: boolean }) => [product.id, product]),
    );
    expect(response.body.meta.total).toBe(3);
    expect(byId.get(phone.id)).toMatchObject({ canPurchase: true, price: '14500.00', currency: 'ETB' });
    expect(byId.get(charger.id)).toMatchObject({ canPurchase: false });
    expect(byId.get(beans.id)).toMatchObject({ canPurchase: false });
    expect(JSON.stringify(response.body)).not.toContain('stockQuantity');
  });

  it('searches by text with prefix matches ranked first, and filters', async () => {
    const { phone, charger, coffee } = await catalog();

    const search = await api().get('/api/v1/products?q=phone').expect(200);
    expect(search.body.data.map((product: { id: string }) => product.id)).toEqual([
      charger.id,
      phone.id,
    ]);

    const available = await api().get('/api/v1/products?available=true').expect(200);
    expect(available.body.data.map((product: { id: string }) => product.id)).toEqual([phone.id]);

    const byCategory = await api().get(`/api/v1/products?category=${coffee.slug}`).expect(200);
    expect(byCategory.body.meta.total).toBe(1);

    const priceRange = await api().get('/api/v1/products?minPrice=500&maxPrice=1000').expect(200);
    expect(priceRange.body.data.map((product: { id: string }) => product.id)).toEqual([charger.id]);

    const cheapest = await api().get('/api/v1/products?sort=price_asc').expect(200);
    expect(cheapest.body.data[0].price).toBe('480.00');

    await api().get('/api/v1/products?minPrice=100&maxPrice=50').expect(400);
  });

  it('treats LIKE wildcards in the query as plain text', async () => {
    await catalog();
    const response = await api().get('/api/v1/products?q=%25').expect(200);
    expect(response.body.data).toHaveLength(0);
  });

  it('returns product detail with shop location, and 404 for hidden products', async () => {
    const { phone } = await catalog();
    const response = await api().get(`/api/v1/products/${phone.id}`).expect(200);
    expect(response.body.data).toMatchObject({
      id: phone.id,
      description: 'A test product',
      shop: { latitude: '7.666700', longitude: '36.833300' },
    });
    const archived = await prisma.product.findFirstOrThrow({ where: { name: 'Archived phone' } });
    await api().get(`/api/v1/products/${archived.id}`).expect(404);
    await api().get('/api/v1/products/not-a-uuid').expect(404);
  });
});
