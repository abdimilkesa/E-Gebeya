import type {
  AdminCustomer,
  AdminMerchant,
  AdminMerchantDetail,
  AdminUsersQuery,
  CreateMerchantInput,
  ResetPasswordInput,
  TemporaryCredentials,
  UpdateMerchantInput,
  UserStatus,
} from '@marketplace/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { conflict, notFound } from '../../lib/errors.js';
import { iso, isoOrNull } from '../../lib/format.js';
import { pageArgs } from '../../lib/http.js';
import { generateTemporaryPassword, hashPassword } from '../../lib/passwords.js';
import { prisma } from '../../lib/prisma.js';
import { isUniqueViolation } from '../../lib/prisma-errors.js';
import { diffFields, writeAudit, type AuditActor } from '../audit/audit.service.js';

const merchantSelect = {
  id: true,
  fullName: true,
  username: true,
  status: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  merchantProfile: { select: { businessName: true, contactPhone: true } },
  _count: { select: { ownedShops: { where: { status: { not: 'REMOVED' as const } } } } },
} satisfies Prisma.UserSelect;

const merchantDetailSelect = {
  ...merchantSelect,
  ownedShops: {
    select: { id: true, name: true, slug: true, status: true },
    orderBy: { name: 'asc' as const },
  },
} satisfies Prisma.UserSelect;

type MerchantRow = Prisma.UserGetPayload<{ select: typeof merchantSelect }>;
type MerchantDetailRow = Prisma.UserGetPayload<{ select: typeof merchantDetailSelect }>;

function toAdminMerchant(user: MerchantRow): AdminMerchant {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    businessName: user.merchantProfile?.businessName ?? null,
    contactPhone: user.merchantProfile?.contactPhone ?? null,
    shopCount: user._count.ownedShops,
    lastLoginAt: isoOrNull(user.lastLoginAt),
    createdAt: iso(user.createdAt),
  };
}

function toAdminMerchantDetail(user: MerchantDetailRow): AdminMerchantDetail {
  return { ...toAdminMerchant(user), shops: user.ownedShops };
}

function userSearch(q: string | undefined): Prisma.UserWhereInput {
  if (!q) return {};
  return {
    OR: [
      { username: { contains: q, mode: 'insensitive' } },
      { fullName: { contains: q, mode: 'insensitive' } },
    ],
  };
}

const usernameTaken = () =>
  conflict('That username is already taken.', [
    { field: 'username', message: 'Choose a different username' },
  ]);

/* ----------------------------------------------------------------------------
 * Merchants
 * ------------------------------------------------------------------------- */

export async function listMerchants(
  query: AdminUsersQuery,
): Promise<{ items: AdminMerchant[]; total: number }> {
  const where: Prisma.UserWhereInput = {
    role: 'MERCHANT',
    ...(query.status ? { status: query.status } : {}),
    ...userSearch(query.q),
  };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: merchantSelect,
      orderBy: { createdAt: 'desc' },
      ...pageArgs(query.page, query.pageSize),
    }),
    prisma.user.count({ where }),
  ]);
  return { items: rows.map(toAdminMerchant), total };
}

export async function getMerchant(userId: string): Promise<AdminMerchantDetail> {
  const user = await prisma.user.findFirst({
    where: { id: userId, role: 'MERCHANT' },
    select: merchantDetailSelect,
  });
  if (!user) throw notFound('Merchant');
  return toAdminMerchantDetail(user);
}

/** Creates the account with a temporary password that is shown to the admin exactly once. */
export async function createMerchant(
  input: CreateMerchantInput,
  actor: AuditActor,
): Promise<TemporaryCredentials> {
  const username = input.username;
  const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (existing) throw usernameTaken();

  const temporaryPassword = input.temporaryPassword ?? generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          role: 'MERCHANT',
          fullName: input.fullName,
          username,
          passwordHash,
          mustChangePassword: true,
          merchantProfile: {
            create: {
              businessName: input.businessName ?? null,
              contactPhone: input.contactPhone,
              createdByUserId: actor.actorUserId,
            },
          },
        },
        select: { id: true, username: true },
      });
      // The password never goes into the audit trail.
      await writeAudit(tx, actor, {
        action: 'merchant.created',
        entityType: 'user',
        entityId: created.id,
        metadata: { username: created.username },
      });
      return created;
    });
    return { id: user.id, username: user.username, temporaryPassword, mustChangePassword: true };
  } catch (error) {
    if (isUniqueViolation(error, 'username')) throw usernameTaken();
    throw error;
  }
}

export async function updateMerchant(
  userId: string,
  input: UpdateMerchantInput,
  actor: AuditActor,
): Promise<AdminMerchantDetail> {
  const before = await prisma.user.findFirst({
    where: { id: userId, role: 'MERCHANT' },
    include: { merchantProfile: true },
  });
  if (!before) throw notFound('Merchant');

  const profileData = {
    ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
    ...(input.businessName !== undefined ? { businessName: input.businessName } : {}),
  };
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(Object.keys(profileData).length > 0
          ? {
              merchantProfile: {
                upsert: { create: profileData, update: profileData },
              },
            }
          : {}),
      },
      select: merchantDetailSelect,
    });
    await writeAudit(tx, actor, {
      action: 'merchant.updated',
      entityType: 'user',
      entityId: userId,
      metadata: {
        changes: diffFields(
          {
            fullName: before.fullName,
            contactPhone: before.merchantProfile?.contactPhone ?? null,
            businessName: before.merchantProfile?.businessName ?? null,
          },
          {
            fullName: input.fullName,
            contactPhone: input.contactPhone,
            businessName: input.businessName,
          },
        ),
      },
    });
    return toAdminMerchantDetail(user);
  });
}

export async function resetMerchantPassword(
  userId: string,
  input: ResetPasswordInput,
  actor: AuditActor,
): Promise<TemporaryCredentials> {
  const user = await prisma.user.findFirst({
    where: { id: userId, role: 'MERCHANT' },
    select: { id: true, username: true },
  });
  if (!user) throw notFound('Merchant');

  const temporaryPassword = input.temporaryPassword ?? generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true, tokenVersion: { increment: 1 } },
    });
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await writeAudit(tx, actor, {
      action: 'merchant.password_reset',
      entityType: 'user',
      entityId: userId,
      metadata: { username: user.username },
    });
  });
  return { id: user.id, username: user.username, temporaryPassword, mustChangePassword: true };
}

/* ----------------------------------------------------------------------------
 * Customers
 * ------------------------------------------------------------------------- */

const customerSelect = {
  id: true,
  fullName: true,
  username: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

function toAdminCustomer(user: Prisma.UserGetPayload<{ select: typeof customerSelect }>): AdminCustomer {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    status: user.status,
    lastLoginAt: isoOrNull(user.lastLoginAt),
    createdAt: iso(user.createdAt),
  };
}

export async function listCustomers(
  query: AdminUsersQuery,
): Promise<{ items: AdminCustomer[]; total: number }> {
  const where: Prisma.UserWhereInput = {
    role: 'CUSTOMER',
    ...(query.status ? { status: query.status } : {}),
    ...userSearch(query.q),
  };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: customerSelect,
      orderBy: { createdAt: 'desc' },
      ...pageArgs(query.page, query.pageSize),
    }),
    prisma.user.count({ where }),
  ]);
  return { items: rows.map(toAdminCustomer), total };
}

export async function getCustomer(userId: string): Promise<AdminCustomer> {
  const user = await prisma.user.findFirst({
    where: { id: userId, role: 'CUSTOMER' },
    select: customerSelect,
  });
  if (!user) throw notFound('Customer');
  return toAdminCustomer(user);
}

/* ----------------------------------------------------------------------------
 * Account status (merchants and customers; admins are never targeted)
 * ------------------------------------------------------------------------- */

export async function setAccountStatus(
  userId: string,
  role: 'MERCHANT' | 'CUSTOMER',
  status: UserStatus,
  actor: AuditActor,
): Promise<{ id: string; status: UserStatus }> {
  const user = await prisma.user.findFirst({
    where: { id: userId, role },
    select: { id: true, status: true, username: true },
  });
  if (!user) throw notFound(role === 'MERCHANT' ? 'Merchant' : 'Customer');
  if (user.status === status) return { id: user.id, status };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        status,
        // Suspension ends every live session immediately.
        ...(status === 'SUSPENDED' ? { tokenVersion: { increment: 1 } } : {}),
      },
    });
    if (status === 'SUSPENDED') {
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await writeAudit(tx, actor, {
      action: `${role.toLowerCase()}.status_changed`,
      entityType: 'user',
      entityId: userId,
      metadata: { username: user.username, from: user.status, to: status },
    });
  });
  return { id: user.id, status };
}
