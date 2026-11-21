import {
  LOW_STOCK_THRESHOLD,
  type ManagedShop,
  type MerchantDashboard,
  type MerchantProduct,
  type MerchantProductsQuery,
  type MerchantProfile,
  type UpdateMerchantProfileInput,
  type createProductSchema,
  type updateProductSchema,
} from '@marketplace/contracts';
import type { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { notFound, validationError } from '../../lib/errors.js';
import { Decimal, iso, money } from '../../lib/format.js';
import { pageArgs } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { diffFields, writeAudit, type AuditActor } from '../audit/audit.service.js';
import {
  managedShopSelect,
  merchantProductSelect,
  toManagedShop,
  toMerchantProduct,
} from '../catalog/mappers.js';
import { resolveImages } from '../media/storage.js';

type CreateProduct = z.output<typeof createProductSchema>;
type UpdateProduct = z.output<typeof updateProductSchema>;

/*
 * Ownership is part of every query: a merchant can only reach products whose shop they
 * currently own and that the Super Admin has not removed. Anything else is a 404, so the
 * API never confirms that another merchant's id exists.
 */
const ownedShopWhere = (merchantId: string) =>
  ({ merchantId, status: { not: 'REMOVED' } }) satisfies Prisma.ShopWhereInput;

const ownedProductWhere = (merchantId: string, productId: string) =>
  ({ id: productId, shop: ownedShopWhere(merchantId) }) satisfies Prisma.ProductWhereInput;

async function findOwnedProduct(merchantId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: ownedProductWhere(merchantId, productId),
    select: merchantProductSelect,
  });
  if (!product) throw notFound('Product');
  return product;
}

async function assertActiveCategory(categoryId: string) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, isActive: true },
    select: { id: true },
  });
  if (!category) {
    throw validationError('Choose an active category.', [
      { field: 'categoryId', message: 'Category not found or inactive' },
    ]);
  }
}

/** Uses the given shop if the merchant owns it; with no shop given, uses their only shop. */
async function resolveTargetShop(merchantId: string, shopId: string | undefined): Promise<string> {
  if (shopId) {
    const shop = await prisma.shop.findFirst({
      where: { id: shopId, ...ownedShopWhere(merchantId) },
      select: { id: true },
    });
    if (!shop) throw notFound('Shop');
    return shop.id;
  }
  const shops = await prisma.shop.findMany({
    where: ownedShopWhere(merchantId),
    select: { id: true },
    take: 2,
  });
  if (shops.length === 1 && shops[0]) return shops[0].id;
  throw validationError(
    shops.length === 0
      ? 'You do not have a shop yet. Ask the platform administrator to assign one.'
      : 'Choose which shop this product belongs to.',
    [{ field: 'shopId', message: 'Shop is required' }],
  );
}

export async function getDashboard(merchantId: string): Promise<MerchantDashboard> {
  const productScope = { shop: ownedShopWhere(merchantId) } satisfies Prisma.ProductWhereInput;
  const activeScope = { ...productScope, status: 'ACTIVE' } satisfies Prisma.ProductWhereInput;

  const [shops, statusGroups, outOfStock, unavailable, lowStock, lowStockProducts, recent] =
    await Promise.all([
      prisma.shop.findMany({
        where: ownedShopWhere(merchantId),
        select: { id: true, name: true, slug: true, status: true },
        orderBy: { name: 'asc' },
      }),
      prisma.product.groupBy({ by: ['status'], where: productScope, _count: { _all: true } }),
      prisma.product.count({ where: { ...activeScope, stockQuantity: 0 } }),
      prisma.product.count({ where: { ...activeScope, isAvailable: false } }),
      prisma.product.count({
        where: { ...activeScope, stockQuantity: { gt: 0, lte: LOW_STOCK_THRESHOLD } },
      }),
      prisma.product.findMany({
        where: { ...activeScope, stockQuantity: { lte: LOW_STOCK_THRESHOLD } },
        select: { id: true, name: true, stockQuantity: true, shop: { select: { name: true } } },
        orderBy: [{ stockQuantity: 'asc' }, { name: 'asc' }],
        take: 5,
      }),
      prisma.product.findMany({
        where: productScope,
        select: { id: true, name: true, price: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
    ]);

  const byStatus = (status: 'ACTIVE' | 'ARCHIVED') =>
    statusGroups.find((group) => group.status === status)?._count._all ?? 0;

  return {
    // The caller is authenticated, so their account is active: visibility depends on the shop.
    shops: shops.map((shop) => ({ ...shop, isPublic: shop.status === 'ACTIVE' })),
    products: {
      total: byStatus('ACTIVE') + byStatus('ARCHIVED'),
      active: byStatus('ACTIVE'),
      archived: byStatus('ARCHIVED'),
      outOfStock,
      unavailable,
      lowStock,
    },
    lowStockProducts: lowStockProducts.map((product) => ({
      id: product.id,
      name: product.name,
      stockQuantity: product.stockQuantity,
      shopName: product.shop.name,
    })),
    recentProducts: recent.map((product) => ({
      id: product.id,
      name: product.name,
      price: money(product.price),
      updatedAt: iso(product.updatedAt),
    })),
  };
}

export async function listShops(merchantId: string): Promise<ManagedShop[]> {
  const shops = await prisma.shop.findMany({
    where: ownedShopWhere(merchantId),
    select: managedShopSelect,
    orderBy: { name: 'asc' },
  });
  return shops.map(toManagedShop);
}

export async function listProducts(
  merchantId: string,
  query: MerchantProductsQuery,
): Promise<{ items: MerchantProduct[]; total: number }> {
  const where: Prisma.ProductWhereInput = {
    shop: ownedShopWhere(merchantId),
    ...(query.shopId ? { shopId: query.shopId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.stock === 'in_stock' ? { stockQuantity: { gt: 0 } } : {}),
    ...(query.stock === 'out_of_stock' ? { stockQuantity: 0 } : {}),
    ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: merchantProductSelect,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      ...pageArgs(query.page, query.pageSize),
    }),
    prisma.product.count({ where }),
  ]);
  return { items: rows.map(toMerchantProduct), total };
}

export async function getProduct(merchantId: string, productId: string): Promise<MerchantProduct> {
  return toMerchantProduct(await findOwnedProduct(merchantId, productId));
}

export async function createProduct(
  merchantId: string,
  input: CreateProduct,
  actor: AuditActor,
): Promise<MerchantProduct> {
  const shopId = await resolveTargetShop(merchantId, input.shopId);
  await assertActiveCategory(input.categoryId);
  const images = await resolveImages(
    input.images.map((image) => image.publicId),
    'products',
    'images',
  );

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        shopId,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        price: new Decimal(input.price),
        stockQuantity: input.stockQuantity,
        isAvailable: input.isAvailable,
        images: {
          create: images.map((image, position) => ({ ...image, position })),
        },
      },
      select: merchantProductSelect,
    });
    await writeAudit(tx, actor, {
      action: 'product.created',
      entityType: 'product',
      entityId: product.id,
      metadata: { shopId, name: product.name, price: money(product.price) },
    });
    return toMerchantProduct(product);
  });
}

export async function updateProduct(
  merchantId: string,
  productId: string,
  input: UpdateProduct,
  actor: AuditActor,
): Promise<MerchantProduct> {
  const before = await findOwnedProduct(merchantId, productId);
  if (input.categoryId && input.categoryId !== before.category.id) {
    await assertActiveCategory(input.categoryId);
  }
  const images = input.images
    ? await resolveImages(
        input.images.map((image) => image.publicId),
        'products',
        'images',
      )
    : undefined;

  const data = {
    ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.price !== undefined ? { price: new Decimal(input.price) } : {}),
    ...(input.stockQuantity !== undefined ? { stockQuantity: input.stockQuantity } : {}),
    ...(input.isAvailable !== undefined ? { isAvailable: input.isAvailable } : {}),
  };

  return prisma.$transaction(async (tx) => {
    if (images) {
      // Replace the whole ordered list; positions are rewritten from 0.
      await tx.productImage.deleteMany({ where: { productId } });
    }
    const product = await tx.product.update({
      where: { id: productId },
      data: {
        ...data,
        ...(images
          ? { images: { create: images.map((image, position) => ({ ...image, position })) } }
          : {}),
      },
      select: merchantProductSelect,
    });
    await writeAudit(tx, actor, {
      action: 'product.updated',
      entityType: 'product',
      entityId: productId,
      metadata: {
        changes: diffFields({ ...before, categoryId: before.category.id }, data),
        ...(images ? { imagesReplaced: images.length } : {}),
      },
    });
    return toMerchantProduct(product);
  });
}

async function setProductStatus(
  merchantId: string,
  productId: string,
  status: 'ACTIVE' | 'ARCHIVED',
  actor: AuditActor,
): Promise<MerchantProduct> {
  const before = await findOwnedProduct(merchantId, productId);
  if (status === 'ACTIVE') await assertActiveCategory(before.category.id);
  if (before.status === status) return toMerchantProduct(before);
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id: productId },
      data: { status },
      select: merchantProductSelect,
    });
    await writeAudit(tx, actor, {
      action: status === 'ARCHIVED' ? 'product.archived' : 'product.restored',
      entityType: 'product',
      entityId: productId,
      metadata: { name: product.name },
    });
    return toMerchantProduct(product);
  });
}

/** Delete means archive: order history keeps pointing at the row. */
export const archiveProduct = (merchantId: string, productId: string, actor: AuditActor) =>
  setProductStatus(merchantId, productId, 'ARCHIVED', actor);

export const restoreProduct = (merchantId: string, productId: string, actor: AuditActor) =>
  setProductStatus(merchantId, productId, 'ACTIVE', actor);

const profileSelect = {
  id: true,
  fullName: true,
  username: true,
  mustChangePassword: true,
  merchantProfile: { select: { businessName: true, contactPhone: true } },
} satisfies Prisma.UserSelect;

function toProfile(user: Prisma.UserGetPayload<{ select: typeof profileSelect }>): MerchantProfile {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    mustChangePassword: user.mustChangePassword,
    businessName: user.merchantProfile?.businessName ?? null,
    contactPhone: user.merchantProfile?.contactPhone ?? null,
  };
}

export async function getProfile(merchantId: string): Promise<MerchantProfile> {
  const user = await prisma.user.findUnique({ where: { id: merchantId }, select: profileSelect });
  if (!user) throw notFound('Merchant');
  return toProfile(user);
}

export async function updateProfile(
  merchantId: string,
  input: UpdateMerchantProfileInput,
): Promise<MerchantProfile> {
  const contactPhone = input.contactPhone;
  const user = await prisma.user.update({
    where: { id: merchantId },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(contactPhone !== undefined
        ? {
            merchantProfile: {
              upsert: { create: { contactPhone }, update: { contactPhone } },
            },
          }
        : {}),
    },
    select: profileSelect,
  });
  return toProfile(user);
}
