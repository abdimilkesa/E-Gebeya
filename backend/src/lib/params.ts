import type { Request } from 'express';
import { z } from 'zod';
import { notFound } from './errors.js';

const uuid = z.uuid();
const slug = z.string().max(180).regex(/^[a-z0-9-]+$/);

/** A malformed id in a URL is reported as "not found", like an id that does not exist. */
export function idParam(req: Request, name: string, resource: string): string {
  const parsed = uuid.safeParse(req.params[name]);
  if (!parsed.success) throw notFound(resource);
  return parsed.data;
}

export function slugParam(req: Request, name: string, resource: string): string {
  const parsed = slug.safeParse(req.params[name]);
  if (!parsed.success) throw notFound(resource);
  return parsed.data;
}

/** Escapes LIKE wildcards so user text is matched literally. */
export const escapeLike = (text: string): string => text.replace(/[\\%_]/g, (char) => `\\${char}`);
