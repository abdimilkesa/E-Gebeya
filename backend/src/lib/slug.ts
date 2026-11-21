import { randomBytes } from 'node:crypto';

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150)
    .replace(/-+$/g, '');
}

/**
 * Builds a unique slug from a display name. Names without Latin letters (e.g. Amharic)
 * fall back to `fallback` plus a random suffix.
 */
export async function uniqueSlug(
  name: string,
  fallback: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(name) || `${fallback}-${randomBytes(3).toString('hex')}`;
  if (!(await isTaken(root))) return root;
  for (let n = 2; n <= 20; n += 1) {
    const candidate = `${root}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${root}-${randomBytes(4).toString('hex')}`;
}
