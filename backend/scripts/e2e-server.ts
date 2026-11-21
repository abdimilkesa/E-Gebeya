/**
 * Runs the API against the disposable end-to-end database (E2E_DATABASE_URL) with known,
 * test-only accounts. Playwright starts it, and it is handy for manual browser checks:
 *   1. apply migrations   2. wipe every table   3. seed admin, categories and demo shops   4. serve
 *
 * It refuses to run unless the database name contains "e2e", so it can never wipe real data.
 * The passwords below protect nothing but that throwaway database.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const backendDir = fileURLToPath(new URL('..', import.meta.url));
// CLIs run through Node itself: `npx` is a .cmd shim on Windows that execFileSync cannot spawn.
const resolveBin = createRequire(import.meta.url).resolve;
const prismaCli = resolveBin('prisma/build/index.js');
const tsxCli = resolveBin('tsx/cli');
loadEnv({ path: path.join(backendDir, '..', '.env'), quiet: true });

const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) throw new Error('E2E_DATABASE_URL is not set (see .env.example).');
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');
if (!databaseName.includes('e2e')) {
  throw new Error(`Refusing to wipe "${databaseName}": the end-to-end database name must contain "e2e".`);
}

// Set before the app modules load, because src/config/env.ts reads process.env on import.
Object.assign(process.env, {
  NODE_ENV: 'development',
  DATABASE_URL: databaseUrl,
  DIRECT_DATABASE_URL: databaseUrl,
  PORT: process.env.E2E_API_PORT ?? '4100',
  FRONTEND_ORIGIN: process.env.E2E_FRONTEND_ORIGIN ?? 'http://localhost:5174',
  RATE_LIMIT_ENABLED: 'false',
  STORAGE_DRIVER: 'local',
  LOCAL_STORAGE_DIR: mkdtempSync(path.join(tmpdir(), 'marketplace-e2e-')),
  LOG_LEVEL: process.env.E2E_LOG_LEVEL ?? 'warn',
  ADMIN_USERNAME: 'superadmin',
  ADMIN_FULL_NAME: 'Platform Administrator',
  ADMIN_INITIAL_PASSWORD: process.env.E2E_ADMIN_PASSWORD ?? 'E2e-admin-pass-2026',
  DEMO_ACCOUNT_PASSWORD: process.env.E2E_DEMO_PASSWORD ?? 'E2e-demo-pass-2026',
});

const runNode = (args: string[]) =>
  execFileSync(process.execPath, args, {
    cwd: backendDir,
    env: process.env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });

runNode([prismaCli, 'migrate', 'deploy']);

const { prisma } = await import('../src/lib/prisma.js');
const tables = (
  await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
).map((row) => `"public"."${row.tablename}"`);
if (tables.length > 0) {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
}

runNode([tsxCli, 'prisma/seed.ts']);
runNode([tsxCli, 'prisma/seed-demo.ts']);

await import('../src/server.js');
