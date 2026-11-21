import type { AuditLogEntry, AuditLogsQuery } from '@marketplace/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { iso } from '../../lib/format.js';
import { pageArgs } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';

export async function listAuditLogs(
  query: AuditLogsQuery,
): Promise<{ items: AuditLogEntry[]; total: number }> {
  const where: Prisma.AuditLogWhereInput = {
    ...(query.action ? { action: { startsWith: query.action } } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.entityId ? { entityId: query.entityId } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, username: true } } },
      ...pageArgs(query.page, query.pageSize),
    }),
    prisma.auditLog.count({ where }),
  ]);
  return {
    items: rows.map((row) => ({
      id: row.id,
      actor: row.actor,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata:
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {},
      ipAddress: row.ipAddress,
      createdAt: iso(row.createdAt),
    })),
    total,
  };
}
