import type { AdminOverview } from '@marketplace/contracts';
import { iso } from '../../lib/format.js';
import { prisma } from '../../lib/prisma.js';

function countBy<K extends string>(
  groups: { status: K; _count: { _all: number } }[],
  status: K,
): number {
  return groups.find((group) => group.status === status)?._count._all ?? 0;
}

const sum = (groups: { _count: { _all: number } }[]) =>
  groups.reduce((total, group) => total + group._count._all, 0);

export async function getOverview(): Promise<AdminOverview> {
  const [
    shops,
    merchants,
    merchantsPendingPassword,
    customers,
    products,
    outOfStock,
    categoryTotal,
    categoryActive,
    recentShops,
  ] = await Promise.all([
    prisma.shop.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.user.groupBy({ by: ['status'], where: { role: 'MERCHANT' }, _count: { _all: true } }),
    prisma.user.count({ where: { role: 'MERCHANT', mustChangePassword: true } }),
    prisma.user.groupBy({ by: ['status'], where: { role: 'CUSTOMER' }, _count: { _all: true } }),
    prisma.product.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.product.count({ where: { status: 'ACTIVE', stockQuantity: 0 } }),
    prisma.category.count(),
    prisma.category.count({ where: { isActive: true } }),
    prisma.shop.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        merchant: { select: { username: true } },
      },
    }),
  ]);

  return {
    shops: {
      total: sum(shops),
      active: countBy(shops, 'ACTIVE'),
      suspended: countBy(shops, 'SUSPENDED'),
      removed: countBy(shops, 'REMOVED'),
    },
    merchants: {
      total: sum(merchants),
      active: countBy(merchants, 'ACTIVE'),
      suspended: countBy(merchants, 'SUSPENDED'),
      pendingPasswordChange: merchantsPendingPassword,
    },
    customers: {
      total: sum(customers),
      active: countBy(customers, 'ACTIVE'),
      suspended: countBy(customers, 'SUSPENDED'),
    },
    products: {
      total: sum(products),
      active: countBy(products, 'ACTIVE'),
      archived: countBy(products, 'ARCHIVED'),
      outOfStock,
    },
    categories: { total: categoryTotal, active: categoryActive },
    recentShops: recentShops.map((shop) => ({
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      status: shop.status,
      merchantUsername: shop.merchant.username,
      createdAt: iso(shop.createdAt),
    })),
  };
}
