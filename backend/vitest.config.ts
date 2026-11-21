import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

loadEnv({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL must be set to run backend tests (see .env.example).');
}
// Tests truncate every table, so never let them point at the development database.
if (testDatabaseUrl === process.env.DATABASE_URL || !/test/i.test(new URL(testDatabaseUrl).pathname)) {
  throw new Error('TEST_DATABASE_URL must be a separate database whose name contains "test".');
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    setupFiles: ['tests/setup.ts'],
    // Files share one database, so they run one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      DIRECT_DATABASE_URL: testDatabaseUrl,
      JWT_ACCESS_SECRET: 'test-only-secret-that-is-at-least-32-characters-long',
      FRONTEND_ORIGIN: 'http://localhost:5173',
      COOKIE_SECURE: 'false',
      TRUST_PROXY: 'false',
      RATE_LIMIT_ENABLED: 'false',
      LOG_LEVEL: 'silent',
      STORAGE_DRIVER: 'local',
      LOCAL_STORAGE_DIR: mkdtempSync(path.join(tmpdir(), 'marketplace-test-uploads-')),
    },
  },
});
