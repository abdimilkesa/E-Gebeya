import { Prisma } from '../generated/prisma/client.js';

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

/** ETB amounts always leave the API as strings with two decimals. */
export const money = (value: Prisma.Decimal | number | string): string =>
  new Prisma.Decimal(value).toFixed(2);

/** Coordinates always leave the API as strings with six decimals. */
export const coordinate = (value: Prisma.Decimal | number | string): string =>
  new Prisma.Decimal(value).toFixed(6);

export const iso = (value: Date): string => value.toISOString();

export const isoOrNull = (value: Date | null): string | null => (value ? value.toISOString() : null);
