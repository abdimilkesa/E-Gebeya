import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Brings the test database schema up to date once per run. This runs in Vitest's main
 * process, where DATABASE_URL still names the development database, so the test URL is
 * passed explicitly (vitest.config.ts has already verified it is a separate database).
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set');
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}
