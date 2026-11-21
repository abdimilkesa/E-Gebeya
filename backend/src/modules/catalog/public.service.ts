import type {
  PublicCategory,
  PublicProduct,
  PublicProductDetail,
  PublicProductsQuery,
  PublicShopDetail,
  PublicShopSummary,
  PublicShopsQuery,
} from '@marketplace/contracts';
import { Prisma } from '../../generated/prisma/client.js';
import { notFound } from '../../lib/errors.js';
import { pageArgs } from '../../lib/http.js';
import { escapeLike } from '../../lib/params.js';
import { prisma } from '../../lib/prisma.js';
import {
  publicProductDetailSelect,
  publicProductSelect,
  publicShopDetailSelect,
  publicShopSelect,
  toPublicCategory,
  toPublicProduct,
  toPublicProductDetail,
  toPublicShopDetail,
  toPublicShopSummary,
} from './mappers.js';
import { publicProductWhere, publicShopWhere } from './visibility.js';

export async function listActiveCategories(): Promise<PublicCategory[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  });
  return categories.map(toPublicCategory);
}

/** Distinct active categories of each shop's visible products, for map filters and chips. */
async function categoriesByShop(shopIds: string[]): Promise<Map<string, PublicCategory[]>> {
  const result = new Map<string, PublicCategory[]>();
  if (shopIds.length === 0) return result;
  const rows = await prisma.product.findMany({
    where: { shopId: { in: shopIds }, status: 'ACTIVE', category: { isActive: true } },
    select: { shopId: true, category: { select: { id: true, name: true, slug: true } } },
    distinct: ['shopId', 'categoryId'],
  });
  for (const row of rows) {
    const list = result.get(row.shopId) ?? [];
    list.push(toPublicCategory(row.category));
    result.set(row.shopId, list);
  }
  for (const list of result.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

export async function listPublicShops(
  query: PublicShopsQuery,
): Promise<{ items: PublicShopSummary[]; total: number }> {
  const filters: Prisma.ShopWhereInput[] = [];
  if (query.q) filters.push({ name: { contains: query.q, mode: 'insensitive' } });
  if (query.product) {
    filters.push({
      products: {
        some: {
          status: 'ACTIVE',
          OR: [
            { name: { contains: query.product, mode: 'insensitive' } },
            { description: { contains: query.product, mode: 'insensitive' } },
          ],
        },
      },
    });
  }
  if (query.category) {
    filters.push({
      products: { some: { status: 'ACTIVE', category: { slug: query.category, isActive: true } } },
    });
  }
  if (
    query.swLat !== undefined &&
    query.swLng !== undefined &&
    query.neLat !== undefined &&
    query.neLng !== undefined
  ) {
    filters.push({ latitude: { gte: query.swLat, lte: query.neLat } });
    // A viewport that crosses the antimeridian has its west edge east of its east edge.
    filters.push(
      query.swLng <= query.neLng
        ? { longitude: { gte: query.swLng, lte: query.neLng } }
        : { OR: [{ longitude: { gte: query.swLng } }, { longitude: { lte: query.neLng } }] },
    );
  }

  const where: Prisma.ShopWhereInput = { ...publicShopWhere, AND: filters };
  const [shops, total] = await Promise.all([
    prisma.shop.findMany({
      where,
      select: publicShopSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...pageArgs(query.page, query.pageSize),
    }),
    prisma.shop.count({ where }),
  ]);
  const categories = await categoriesByShop(shops.map((shop) => shop.id));
  return {
    items: shops.map((shop) => toPublicShopSummary(shop, categories.get(shop.id) ?? [])),
    total,
  };
}

export async function getPublicShop(slug: string): Promise<PublicShopDetail> {
  const shop = await prisma.shop.findFirst({
    where: { ...publicShopWhere, slug },
    select: publicShopDetailSelect,
  });
  if (!shop) throw notFound('Shop');
  const categories = await categoriesByShop([shop.id]);
  return toPublicShopDetail(shop, categories.get(shop.id) ?? []);
}

/**
 * Cross-shop product search. Filtering and ordering run as SQL over the
 * `public_catalog_products` view (visibility rule + trigram relevance); the page of ids
 * is then loaded through Prisma so the response shape stays typed.
 */
export async function listPublicProducts(
  query: PublicProductsQuery,
): Promise<{ items: PublicProduct[]; total: number }> {
  const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    conditions.push(Prisma.sql`(v.name ILIKE ${pattern} OR v.description ILIKE ${pattern})`);
  }
  if (query.shopId) conditions.push(Prisma.sql`v.shop_id = ${query.shopId}::uuid`);
  if (query.shop) conditions.push(Prisma.sql`v.shop_slug = ${query.shop}`);
  if (query.category) conditions.push(Prisma.sql`v.category_slug = ${query.category}`);
  if (query.minPrice) conditions.push(Prisma.sql`v.price >= ${query.minPrice}::numeric`);
  if (query.maxPrice) conditions.push(Prisma.sql`v.price <= ${query.maxPrice}::numeric`);
  if (query.available !== undefined) {
    conditions.push(query.available ? Prisma.sql`v.can_purchase` : Prisma.sql`NOT v.can_purchase`);
  }
  const where = Prisma.join(conditions, ' AND ');

  let orderBy: Prisma.Sql;
  switch (query.sort) {
    case 'price_asc':
      orderBy = Prisma.sql`v.price ASC, v.created_at DESC`;
      break;
    case 'price_desc':
      orderBy = Prisma.sql`v.price DESC, v.created_at DESC`;
      break;
    case 'newest':
      orderBy = Prisma.sql`v.created_at DESC`;
      break;
    default:
      orderBy = query.q
        ? Prisma.sql`(v.name ILIKE ${`${escapeLike(query.q)}%`}) DESC,
            similarity(v.name, ${query.q}) DESC, v.created_at DESC`
        : Prisma.sql`v.can_purchase DESC, v.created_at DESC`;
  }

  const { skip, take } = pageArgs(query.page, query.pageSize);
  const [rows, counts] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT v.id FROM public_catalog_products v
      WHERE ${where}
      ORDER BY ${orderBy}, v.id
      LIMIT ${take} OFFSET ${skip}`,
    prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total FROM public_catalog_products v WHERE ${where}`,
  ]);

  const ids = rows.map((row) => row.id);
  const products = ids.length
    ? await prisma.product.findMany({ where: { id: { in: ids } }, select: publicProductSelect })
    : [];
  const byId = new Map(products.map((product) => [product.id, product]));
  const items = ids.flatMap((id) => {
    const product = byId.get(id);
    return product ? [toPublicProduct(product)] : [];
  });
  return { items, total: counts[0]?.total ?? 0 };
}

export async function getPublicProduct(productId: string): Promise<PublicProductDetail> {
  const product = await prisma.product.findFirst({
    where: { ...publicProductWhere, id: productId },
    select: publicProductDetailSelect,
  });
  if (!product) throw notFound('Product');
  return toPublicProductDetail(product);
}
