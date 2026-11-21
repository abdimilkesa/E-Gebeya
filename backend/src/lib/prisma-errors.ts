import { Prisma } from '../generated/prisma/client.js';

/**
 * True when a write failed on a unique constraint. With driver adapters the violated
 * fields are reported in a different place than with the classic engine, so both are read.
 */
export function isUniqueViolation(error: unknown, field?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  if (!field) return true;
  const meta = (error.meta ?? {}) as {
    target?: string | string[];
    driverAdapterError?: { cause?: { constraint?: { fields?: string[]; index?: string } } };
  };
  const constraint = meta.driverAdapterError?.cause?.constraint;
  const targets = [
    ...(Array.isArray(meta.target) ? meta.target : meta.target ? [meta.target] : []),
    ...(constraint?.fields ?? []),
    ...(constraint?.index ? [constraint.index] : []),
  ];
  // An unknown target is treated as a match rather than leaking a 500.
  return targets.length === 0 || targets.some((target) => target.includes(field));
}

export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}
