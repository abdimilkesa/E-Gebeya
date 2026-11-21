import { describe, expect, it } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import {
  comparePublicProducts,
  findNearbyPublicShops,
  getPublicShopForAssistant,
  searchPublicProducts,
} from '../src/modules/catalog/assistant-catalog.service.js';
import { createCategory, createMerchantWithShop, createProduct, createShop, createUser } from './helpers.js';

const ORIGIN = { latitude: 7.6667, longitude: 36.8333 };
const SECRET_ACCOUNT = '5555666677778888';

describe('assistant catalog', () => {
  it('finds shoes below 20,000 ETB and leaves out dearer and unrelated products', async () => {
    const { merchant, shop, category } = await createMerchantWithShop();
    await createProduct(shop.id, category.id, {
      name: 'Running shoes',
      price: new Prisma.Decimal('12500.00'),
    });
    await createProduct(shop.id, category.id, {
      name: 'Designer shoes',
      price: new Prisma.Decimal('25000.00'),
    });
    await createProduct(shop.id, category.id, {
      name: 'Laptop',
      price: new Prisma.Decimal('30000.00'),
    });

    const matches = await searchPublicProducts({
      query: 'shoes',
      maxPrice: 20_000,
      availableOnly: true,
      limit: 10,
    });

    expect(matches.map((product) => product.name)).toEqual(['Running shoes']);
    expect(matches[0]).toMatchObject({
      price: '12500.00',
      currency: 'ETB',
      inStock: true,
      shopName: shop.name,
      distanceKm: null,
    });
    expect(JSON.stringify(matches)).not.toContain(SECRET_ACCOUNT);
    expect(merchant.user.passwordHash).toBeTruthy();
    expect(JSON.stringify(matches)).not.toContain(merchant.user.passwordHash);
  });

  it('filters by category slug and by a price range', async () => {
    const { shop } = await createMerchantWithShop();
    const fashion = await createCategory('Fashion');
    const grocery = await createCategory('Groceries');
    await createProduct(shop.id, fashion.id, { name: 'Cotton scarf', price: new Prisma.Decimal('900.00') });
    await createProduct(shop.id, grocery.id, { name: 'Coffee beans', price: new Prisma.Decimal('480.00') });
    await createProduct(shop.id, fashion.id, { name: 'Silk scarf', price: new Prisma.Decimal('4000.00') });

    const byCategory = await searchPublicProducts({ category: fashion.slug, limit: 10 });
    expect(byCategory.map((product) => product.name).sort()).toEqual(['Cotton scarf', 'Silk scarf']);

    const byPrice = await searchPublicProducts({
      category: fashion.slug,
      minPrice: 1000,
      maxPrice: 5000,
      limit: 10,
    });
    expect(byPrice.map((product) => product.name)).toEqual(['Silk scarf']);
  });

  it('returns public shop details and hides a suspended shop and its bank account', async () => {
    const { shop } = await createMerchantWithShop({ bankAccountNumber: SECRET_ACCOUNT });
    const hiddenMerchant = await createUser('MERCHANT', { status: 'SUSPENDED' });
    const hidden = await createShop(hiddenMerchant.id, { name: 'Closed stall', bankAccountNumber: SECRET_ACCOUNT });

    const visible = await getPublicShopForAssistant(shop.id);
    expect(visible).toMatchObject({
      name: shop.name,
      addressText: 'Jimma center',
      phone: '0471112233',
    });
    expect(visible && 'bankAccountNumber' in visible).toBe(false);
    expect(JSON.stringify(visible)).not.toContain(SECRET_ACCOUNT);

    expect(await getPublicShopForAssistant(hidden.id)).toBeNull();
  });

  it('sorts nearby shops by distance and skips products above the budget', async () => {
    const { merchant, category } = await createMerchantWithShop();
    const near = await createShop(merchant.user.id, {
      name: 'Near Shoes',
      slug: `near-shoes-${merchant.user.id.slice(0, 8)}`,
      latitude: new Prisma.Decimal('7.670000'),
      longitude: new Prisma.Decimal('36.834000'),
      bankAccountNumber: SECRET_ACCOUNT,
    });
    const far = await createShop(merchant.user.id, {
      name: 'Far Shoes',
      slug: `far-shoes-${merchant.user.id.slice(0, 8)}`,
      latitude: new Prisma.Decimal('7.750000'),
      longitude: new Prisma.Decimal('36.950000'),
      bankAccountNumber: SECRET_ACCOUNT,
    });
    const nearShoes = await createProduct(near.id, category.id, {
      name: 'Running shoes',
      price: new Prisma.Decimal('12500.00'),
    });
    const farShoes = await createProduct(far.id, category.id, {
      name: 'Leather shoes',
      price: new Prisma.Decimal('18500.00'),
    });
    await createProduct(near.id, category.id, {
      name: 'Designer shoes',
      price: new Prisma.Decimal('25000.00'),
    });

    const groups = await findNearbyPublicShops({
      query: 'shoes',
      maxPrice: 20_000,
      availableOnly: true,
      limit: 10,
      radiusKm: 30,
      origin: ORIGIN,
    });

    expect(groups.map((group) => group.shop.name)).toEqual(['Near Shoes', 'Far Shoes']);
    expect(Number(groups[0]?.shop.distanceKm)).toBeLessThan(Number(groups[1]?.shop.distanceKm));
    expect(groups[0]?.products.map((product) => product.productId)).toEqual([nearShoes.id]);
    expect(groups[1]?.products.map((product) => product.productId)).toEqual([farShoes.id]);
    expect(groups[0]?.products[0]?.distanceKm).toBe(groups[0]?.shop.distanceKm);
    const serialized = JSON.stringify(groups);
    expect(serialized).not.toContain('latitude');
    expect(serialized).not.toContain(SECRET_ACCOUNT);
    expect(serialized).not.toContain(merchant.user.passwordHash);
  });

  it('compares only the public products that were asked for', async () => {
    const { merchant, shop, category } = await createMerchantWithShop({ bankAccountNumber: SECRET_ACCOUNT });
    const cheap = await createProduct(shop.id, category.id, {
      name: 'Canvas shoes',
      price: new Prisma.Decimal('1500.00'),
    });
    const costly = await createProduct(shop.id, category.id, {
      name: 'Leather boots',
      price: new Prisma.Decimal('8000.00'),
    });

    const compared = await comparePublicProducts([costly.id, cheap.id, merchant.user.id]);
    expect(compared.map((product) => product.name)).toEqual(['Leather boots', 'Canvas shoes']);
    expect(JSON.stringify(compared)).not.toContain(merchant.user.passwordHash);
  });
});
