import type { ApiErrorDetail, PageMeta } from '@marketplace/contracts';
import type { Request, Response } from 'express';
import type { z } from 'zod';
import { validationError } from './errors.js';

export function sendData<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data, error: null, meta: {} });
}

export function sendPage<T>(res: Response, items: T[], meta: PageMeta): void {
  res.status(200).json({ success: true, data: items, error: null, meta });
}

export function pageMeta(page: number, pageSize: number, total: number): PageMeta {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function pageArgs(page: number, pageSize: number): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function zodDetails(error: z.ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    ...(issue.path.length > 0 ? { field: issue.path.join('.') } : {}),
    message: issue.message,
  }));
}

function parseWith<S extends z.ZodType>(schema: S, input: unknown, what: string): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = zodDetails(result.error);
    throw validationError(details[0]?.message ?? `Invalid ${what}.`, details);
  }
  return result.data;
}

/** Express 5 exposes `req.query` read-only, so handlers parse into local values instead. */
export const parseBody = <S extends z.ZodType>(schema: S, req: Request): z.output<S> =>
  parseWith(schema, req.body ?? {}, 'request body');

export const parseQuery = <S extends z.ZodType>(schema: S, req: Request): z.output<S> =>
  parseWith(schema, req.query, 'query parameters');

export const parseParams = <S extends z.ZodType>(schema: S, req: Request): z.output<S> =>
  parseWith(schema, req.params, 'path parameters');
