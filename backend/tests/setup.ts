import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/lib/prisma.js';

let tables: string[] | undefined;

/** Every test starts from empty tables; migrations history is kept. */
beforeEach(async () => {
  tables ??= (
    await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  ).map((row) => `"public"."${row.tablename}"`);
  if (tables.length > 0) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
