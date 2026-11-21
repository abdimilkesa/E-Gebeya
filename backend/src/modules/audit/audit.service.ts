import type { Request } from 'express';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../../lib/prisma.js';

export interface AuditActor {
  actorUserId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export function auditActor(req: Request): AuditActor {
  return {
    actorUserId: req.auth?.userId ?? null,
    ipAddress: req.ip?.slice(0, 45) ?? null,
    userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
  };
}

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonObject;
}

/** Call with the transaction client so the audit row commits or rolls back with the change. */
export async function writeAudit(db: DbClient, actor: AuditActor, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      ...actor,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
    },
  });
}

/** Lists the fields whose value actually changed, as `{ field: { from, to } }`. */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Prisma.InputJsonObject {
  const changes: Record<string, { from: Prisma.InputJsonValue | null; to: Prisma.InputJsonValue | null }> =
    {};
  for (const [key, next] of Object.entries(after)) {
    if (next === undefined) continue;
    const previous = before[key];
    const from = normalize(previous);
    const to = normalize(next);
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
  }
  return changes;
}

function normalize(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'toFixed' in value && typeof value.toFixed === 'function') {
    return String(value);
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return JSON.stringify(value);
}
