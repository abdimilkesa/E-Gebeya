import type { AdminCategory, CreateCategoryInput, UpdateCategoryInput } from '@marketplace/contracts';
import { conflict, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { isUniqueViolation } from '../../lib/prisma-errors.js';
import { uniqueSlug } from '../../lib/slug.js';
import { diffFields, writeAudit, type AuditActor } from '../audit/audit.service.js';
import { toAdminCategory } from '../catalog/mappers.js';

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  isActive: true,
  createdAt: true,
  _count: { select: { products: { where: { status: 'ACTIVE' as const } } } },
};

const duplicateName = () =>
  conflict('A category with this name already exists.', [
    { field: 'name', message: 'Choose a different name' },
  ]);

async function assertNameFree(name: string, exceptId?: string) {
  const existing = await prisma.category.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (existing) throw duplicateName();
}

export async function listCategories(): Promise<AdminCategory[]> {
  const rows = await prisma.category.findMany({ orderBy: { name: 'asc' }, select: categorySelect });
  return rows.map(toAdminCategory);
}

export async function createCategory(
  input: CreateCategoryInput,
  actor: AuditActor,
): Promise<AdminCategory> {
  await assertNameFree(input.name);
  const slug = await uniqueSlug(input.name, 'category', async (candidate) =>
    Boolean(await prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } })),
  );
  try {
    return await prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: { name: input.name, slug, description: input.description || null },
        select: categorySelect,
      });
      await writeAudit(tx, actor, {
        action: 'category.created',
        entityType: 'category',
        entityId: category.id,
        metadata: { name: category.name, slug: category.slug },
      });
      return toAdminCategory(category);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateName();
    throw error;
  }
}

export async function updateCategory(
  categoryId: string,
  input: UpdateCategoryInput,
  actor: AuditActor,
): Promise<AdminCategory> {
  const before = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!before) throw notFound('Category');
  if (input.name && input.name.toLowerCase() !== before.name.toLowerCase()) {
    await assertNameFree(input.name, categoryId);
  }
  const data = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description || null } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  };
  try {
    return await prisma.$transaction(async (tx) => {
      // The slug stays stable on rename so existing links keep working.
      const category = await tx.category.update({
        where: { id: categoryId },
        data,
        select: categorySelect,
      });
      await writeAudit(tx, actor, {
        action: 'category.updated',
        entityType: 'category',
        entityId: categoryId,
        metadata: { changes: diffFields(before, data) },
      });
      return toAdminCategory(category);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateName();
    throw error;
  }
}
