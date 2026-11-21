import type { AssistantProductCard, AssistantShopCard } from '@marketplace/contracts';
import { Prisma } from '../../generated/prisma/client.js';
import { money } from '../../lib/format.js';
import { escapeLike } from '../../lib/params.js';
import { prisma } from '../../lib/prisma.js';
import { publicShopWhere } from './visibility.js';

/**
 * The only database path the shopping assistant may use. Queries read the public catalog
 * view or an explicit public-column select. Callers in the AI module receive these DTOs
 * and never a Prisma record.
 */

export interface CatalogSearch {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  availableOnly?: boolean;
  limit: number;
}

export interface NearbySearch extends CatalogSearch {
  origin: { latitude: number; longitude: number };
  radiusKm: number;
}

interface CatalogRow {
  product_id: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  image_url: string | null;
  in_stock: boolean;
  category_name: string | null;
  category_slug: string | null;
  shop_id: string;
  shop_name: string;
  shop_slug: string;
  address_text: string;
}

interface NearbyRow extends CatalogRow {
  distance_km: number;
}

const PRODUCT_COLUMNS = Prisma.sql`
  v.product_id, v.name, v.description, v.price::text AS price, v.currency, v.image_url,
  v.in_stock, v.category_name, v.category_slug, v.shop_id, v.shop_name, v.shop_slug, v.address_text
`;

const clip = (value: string | null, max = 400): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
};

const distanceLabel = (kilometers: number): string =>
  (Math.round(kilometers * 10) / 10).toFixed(1);

function toProduct(row: CatalogRow, distanceKm: string | null): AssistantProductCard {
  return {
    productId: row.product_id,
    name: row.name,
    description: clip(row.description),
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    price: money(row.price),
    currency: 'ETB',
    imageUrl: row.image_url,
    inStock: row.in_stock,
    shopId: row.shop_id,
    shopName: row.shop_name,
    shopSlug: row.shop_slug,
    addressText: row.address_text,
    distanceKm,
  };
}

function filters(input: CatalogSearch): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (input.query) {
    const pattern = `%${escapeLike(input.query)}%`;
    parts.push(Prisma.sql`(v.name ILIKE ${pattern} OR v.description ILIKE ${pattern})`);
  }
  if (input.category) parts.push(Prisma.sql`v.category_slug = ${input.category}`);
  if (input.minPrice !== undefined) parts.push(Prisma.sql`v.price >= ${input.minPrice}::numeric`);
  if (input.maxPrice !== undefined) parts.push(Prisma.sql`v.price <= ${input.maxPrice}::numeric`);
  if (input.availableOnly !== false) parts.push(Prisma.sql`v.in_stock`);
  return Prisma.join(parts, ' AND ');
}

export async function searchPublicProducts(input: CatalogSearch): Promise<AssistantProductCard[]> {
  const where = filters(input);
  const orderBy = input.query
    ? Prisma.sql`similarity(v.name, ${input.query}) DESC, v.price ASC`
    : Prisma.sql`v.price ASC`;
  const rows = await prisma.$queryRaw<CatalogRow[]>`
    SELECT ${PRODUCT_COLUMNS}
    FROM public_catalog_products v
    WHERE ${where}
    ORDER BY ${orderBy}, v.product_id
    LIMIT ${input.limit}
  `;
  return rows.map((row) => toProduct(row, null));
}

export async function getPublicProductForAssistant(
  productId: string,
): Promise<AssistantProductCard | null> {
  const rows = await prisma.$queryRaw<CatalogRow[]>`
    SELECT ${PRODUCT_COLUMNS}
    FROM public_catalog_products v
    WHERE v.product_id = ${productId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  return row ? toProduct(row, null) : null;
}

export async function getPublicShopForAssistant(shopId: string): Promise<AssistantShopCard | null> {
  const shop = await prisma.shop.findFirst({
    where: { id: shopId, ...publicShopWhere },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      addressText: true,
      phone: true,
      logoUrl: true,
    },
  });
  if (!shop) return null;
  return {
    shopId: shop.id,
    name: shop.name,
    slug: shop.slug,
    description: clip(shop.description),
    addressText: shop.addressText,
    phone: shop.phone,
    logoUrl: shop.logoUrl,
    distanceKm: null,
  };
}

export async function comparePublicProducts(productIds: string[]): Promise<AssistantProductCard[]> {
  if (productIds.length === 0) return [];
  const rows = await prisma.$queryRaw<CatalogRow[]>`
    SELECT ${PRODUCT_COLUMNS}
    FROM public_catalog_products v
    WHERE v.product_id IN (${Prisma.join(productIds.map((id) => Prisma.sql`${id}::uuid`))})
  `;
  const byId = new Map(rows.map((row) => [row.product_id, row]));
  return productIds.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toProduct(row, null)] : [];
  });
}

export interface NearbyShopGroup {
  shop: AssistantShopCard;
  products: AssistantProductCard[];
}

export async function findNearbyPublicShops(input: NearbySearch): Promise<NearbyShopGroup[]> {
  const where = filters(input);
  const take = Math.min(input.limit * 5, 40);
  const { latitude, longitude } = input.origin;
  const rows = await prisma.$queryRaw<NearbyRow[]>`
    SELECT product_id, name, description, price, currency, image_url, in_stock,
           category_name, category_slug, shop_id, shop_name, shop_slug, address_text, distance_km
    FROM (
      SELECT ${PRODUCT_COLUMNS},
        (6371 * acos(LEAST(1::float8, GREATEST(-1::float8,
          cos(radians(${latitude}::float8)) * cos(radians(v.shop_latitude::float8))
          * cos(radians(v.shop_longitude::float8) - radians(${longitude}::float8))
          + sin(radians(${latitude}::float8)) * sin(radians(v.shop_latitude::float8))
        )))) AS distance_km
      FROM public_catalog_products v
      WHERE ${where}
    ) matches
    WHERE distance_km <= ${input.radiusKm}::float8
    ORDER BY distance_km ASC, price ASC, product_id
    LIMIT ${take}
  `;

  const order: string[] = [];
  const grouped = new Map<string, { distanceKm: string; products: AssistantProductCard[] }>();
  for (const row of rows) {
    let group = grouped.get(row.shop_id);
    if (!group) {
      if (order.length >= input.limit) break;
      group = { distanceKm: distanceLabel(Number(row.distance_km)), products: [] };
      grouped.set(row.shop_id, group);
      order.push(row.shop_id);
    }
    if (group.products.length < 3) {
      group.products.push(toProduct(row, group.distanceKm));
    }
  }
  if (order.length === 0) return [];

  const shops = await prisma.shop.findMany({
    where: { id: { in: order }, ...publicShopWhere },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      addressText: true,
      phone: true,
      logoUrl: true,
    },
  });
  const byId = new Map(shops.map((shop) => [shop.id, shop]));
  return order.flatMap((shopId) => {
    const shop = byId.get(shopId);
    const group = grouped.get(shopId);
    if (!shop || !group) return [];
    return [
      {
        shop: {
          shopId: shop.id,
          name: shop.name,
          slug: shop.slug,
          description: clip(shop.description),
          addressText: shop.addressText,
          phone: shop.phone,
          logoUrl: shop.logoUrl,
          distanceKm: group.distanceKm,
        },
        products: group.products,
      },
    ];
  });
}
