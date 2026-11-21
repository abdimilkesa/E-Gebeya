import {
  MAX_SAVED_ADDRESSES,
  type CreateAddressInput,
  type CustomerAddress,
  type CustomerProfile,
  type UpdateAddressInput,
  type UpdateProfileInput,
} from '@marketplace/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { businessRule, notFound } from '../../lib/errors.js';
import { iso } from '../../lib/format.js';
import { prisma, type DbClient } from '../../lib/prisma.js';

const profileSelect = { id: true, fullName: true, username: true } satisfies Prisma.UserSelect;

const addressSelect = {
  id: true,
  contactName: true,
  addressName: true,
  houseNumber: true,
  phoneNumber: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerAddressSelect;

type AddressRow = Prisma.CustomerAddressGetPayload<{ select: typeof addressSelect }>;

const toAddress = (row: AddressRow): CustomerAddress => ({
  id: row.id,
  contactName: row.contactName,
  addressName: row.addressName,
  houseNumber: row.houseNumber,
  phoneNumber: row.phoneNumber,
  isDefault: row.isDefault,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
});

export async function getProfile(userId: string, db: DbClient = prisma): Promise<CustomerProfile> {
  const user = await db.user.findUnique({ where: { id: userId }, select: profileSelect });
  if (!user) throw notFound('Customer');
  return user;
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<CustomerProfile> {
  return prisma.user.update({
    where: { id: userId },
    data: { fullName: input.fullName },
    select: profileSelect,
  });
}

export async function listAddresses(userId: string): Promise<CustomerAddress[]> {
  const rows = await prisma.customerAddress.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    select: addressSelect,
  });
  return rows.map(toAddress);
}

/** A saved address of this customer, or 404 for anyone else's id. */
export async function findOwnAddress(db: DbClient, userId: string, addressId: string) {
  const address = await db.customerAddress.findFirst({
    where: { id: addressId, userId },
    select: addressSelect,
  });
  if (!address) throw notFound('Address');
  return address;
}

const clearDefault = (db: DbClient, userId: string) =>
  db.customerAddress.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });

/**
 * Saves an address. The first address becomes the default; making another one the default
 * clears the previous default in the same transaction.
 */
export async function createAddress(
  db: DbClient,
  userId: string,
  fullName: string,
  input: CreateAddressInput,
): Promise<CustomerAddress> {
  const count = await db.customerAddress.count({ where: { userId } });
  if (count >= MAX_SAVED_ADDRESSES) {
    throw businessRule(`You can save at most ${MAX_SAVED_ADDRESSES} addresses. Delete one first.`);
  }
  const isDefault = input.isDefault ?? count === 0;
  if (isDefault) await clearDefault(db, userId);
  const row = await db.customerAddress.create({
    data: {
      userId,
      contactName: input.contactName ?? fullName,
      addressName: input.addressName,
      houseNumber: input.houseNumber,
      phoneNumber: input.phoneNumber,
      isDefault,
    },
    select: addressSelect,
  });
  return toAddress(row);
}

export async function addAddress(userId: string, input: CreateAddressInput): Promise<CustomerAddress> {
  return prisma.$transaction(async (tx) => {
    const { fullName } = await getProfile(userId, tx);
    return createAddress(tx, userId, fullName, input);
  });
}

export async function updateAddress(
  userId: string,
  addressId: string,
  input: UpdateAddressInput,
): Promise<CustomerAddress> {
  return prisma.$transaction(async (tx) => {
    await findOwnAddress(tx, userId, addressId);
    if (input.isDefault) await clearDefault(tx, userId);
    const row = await tx.customerAddress.update({
      where: { id: addressId },
      data: {
        ...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
        ...(input.addressName !== undefined ? { addressName: input.addressName } : {}),
        ...(input.houseNumber !== undefined ? { houseNumber: input.houseNumber } : {}),
        ...(input.phoneNumber !== undefined ? { phoneNumber: input.phoneNumber } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
      select: addressSelect,
    });
    return toAddress(row);
  });
}

/** Placed orders keep their own copy of the contact, so deleting an address changes no order. */
export async function deleteAddress(userId: string, addressId: string): Promise<{ deleted: true }> {
  const { count } = await prisma.customerAddress.deleteMany({ where: { id: addressId, userId } });
  if (count === 0) throw notFound('Address');
  return { deleted: true };
}
