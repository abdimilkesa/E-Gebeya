import type { UserRole } from '@marketplace/contracts';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/lib/passwords.js';
import { prisma } from '../src/lib/prisma.js';

export const app = createApp();
export const api = () => request(app);

export const PASSWORD = 'correct-horse-battery';
let passwordHash: Promise<string> | undefined;
let sequence = 0;

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export interface UserOptions {
  username?: string;
  fullName?: string;
  status?: 'ACTIVE' | 'SUSPENDED';
  mustChangePassword?: boolean;
}

export async function createUser(role: UserRole, options: UserOptions = {}) {
  sequence += 1;
  passwordHash ??= hashPassword(PASSWORD);
  return prisma.user.create({
    data: {
      role,
      username: options.username ?? `${role.toLowerCase()}_${sequence}`,
      fullName: options.fullName ?? `Test ${role.toLowerCase()} ${sequence}`,
      passwordHash: await passwordHash,
      status: options.status ?? 'ACTIVE',
      mustChangePassword: options.mustChangePassword ?? false,
      ...(role === 'MERCHANT'
        ? { merchantProfile: { create: { contactPhone: '0911000000' } } }
        : {}),
    },
  });
}

/** Extracts `refresh_token=...` from a response so it can be replayed as a Cookie header. */
export function refreshCookieOf(response: request.Response): string {
  const header = response.headers['set-cookie'] as unknown;
  const cookies = Array.isArray(header) ? (header as string[]) : [];
  const cookie = cookies.find((value) => value.startsWith('refresh_token='));
  if (!cookie) throw new Error('No refresh_token cookie in response');
  return cookie.split(';')[0] ?? '';
}

export async function login(username: string, password = PASSWORD) {
  const response = await api().post('/api/v1/auth/login').send({ username, password });
  if (response.status !== 200) {
    throw new Error(`Login failed for ${username}: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return {
    token: response.body.data.accessToken as string,
    cookie: refreshCookieOf(response),
  };
}

export async function createAndLogin(role: UserRole, options: UserOptions = {}) {
  const user = await createUser(role, options);
  const session = await login(user.username);
  return { user, ...session };
}

export async function createCategory(name = 'Electronics', isActive = true) {
  sequence += 1;
  return prisma.category.create({
    data: { name: `${name} ${sequence}`, slug: `${name.toLowerCase()}-${sequence}`, isActive },
  });
}

export async function createShop(
  merchantId: string,
  overrides: Partial<Prisma.ShopUncheckedCreateInput> = {},
) {
  sequence += 1;
  return prisma.shop.create({
    data: {
      merchantId,
      name: `Shop ${sequence}`,
      slug: `shop-${sequence}`,
      phone: '0471112233',
      addressText: 'Jimma center',
      latitude: new Prisma.Decimal('7.666700'),
      longitude: new Prisma.Decimal('36.833300'),
      deliveryFeeEtb: new Prisma.Decimal('50.00'),
      bankName: 'Commercial Bank of Ethiopia',
      bankAccountName: 'Owner',
      bankAccountNumber: '1000000000001',
      ...overrides,
    },
  });
}

export async function createProduct(
  shopId: string,
  categoryId: string,
  overrides: Partial<Prisma.ProductUncheckedCreateInput> = {},
) {
  sequence += 1;
  return prisma.product.create({
    data: {
      shopId,
      categoryId,
      name: `Product ${sequence}`,
      description: 'A test product',
      price: new Prisma.Decimal('100.00'),
      stockQuantity: 10,
      ...overrides,
    },
  });
}

/** Merchant + active shop + category, the common starting point for catalog tests. */
export async function createMerchantWithShop(shopOverrides: Partial<Prisma.ShopUncheckedCreateInput> = {}) {
  const merchant = await createAndLogin('MERCHANT');
  const shop = await createShop(merchant.user.id, shopOverrides);
  const category = await createCategory();
  return { merchant, shop, category };
}

/** The smallest valid PNG (1x1 transparent pixel). */
export const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
