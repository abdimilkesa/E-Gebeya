import { z } from 'zod';
import type { ErrorCode } from './enums.js';

/** Business currency. Money travels as decimal strings ("1500.00") so no client uses binary floats. */
export const CURRENCY = 'ETB';

/** Calendar days (order numbers, daily reports) follow Ethiopian local time. */
export const BUSINESS_TIME_ZONE = 'Africa/Addis_Ababa';

/** Demo camera default (Jimma). It is a starting view, not a geofence. */
export const DEFAULT_MAP_CENTER = { lat: 7.6667, lng: 36.8333 } as const;
export const DEFAULT_MAP_ZOOM = 13;

export const MAX_PRODUCT_IMAGES = 5;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_CART_LINE_QUANTITY = 99;
export const MAX_CART_LINES = 30;

export const uuidSchema = z.uuid('Must be a valid id');

export const MONEY_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

/** Non-negative ETB amount with at most two decimals, max 99,999,999.99. */
export const moneySchema = z
  .string()
  .trim()
  .regex(MONEY_PATTERN, 'Use an amount like 1500 or 1500.50 (at most two decimals)');

export const positiveMoneySchema = moneySchema.refine(
  (value) => Number(value) > 0,
  'Amount must be greater than 0',
);

const COORDINATE_PATTERN = /^-?\d{1,3}(\.\d{1,6})?$/;

export const latitudeSchema = z
  .string()
  .trim()
  .regex(COORDINATE_PATTERN, 'Use decimal degrees with up to 6 decimals')
  .refine((value) => Math.abs(Number(value)) <= 90, 'Latitude must be between -90 and 90');

export const longitudeSchema = z
  .string()
  .trim()
  .regex(COORDINATE_PATTERN, 'Use decimal degrees with up to 6 decimals')
  .refine((value) => Math.abs(Number(value)) <= 180, 'Longitude must be between -180 and 180');

/** Ethiopian mobile numbers: Ethio Telecom (09…) and Safaricom (07…). */
export const ETHIOPIAN_MOBILE_PATTERN = /^(\+251|0)[79]\d{8}$/;
/** Any Ethiopian number, including landlines such as Jimma's 047 area code. */
export const ETHIOPIAN_PHONE_PATTERN = /^(\+251|0)\d{9}$/;

const stripPhoneSeparators = (value: string) => value.replace(/[\s-]/g, '');

export const phoneSchema = z
  .string()
  .trim()
  .transform(stripPhoneSeparators)
  .pipe(z.string().regex(ETHIOPIAN_PHONE_PATTERN, 'Use an Ethiopian number such as 0471112233'));

export const mobilePhoneSchema = z
  .string()
  .trim()
  .transform(stripPhoneSeparators)
  .pipe(
    z.string().regex(ETHIOPIAN_MOBILE_PATTERN, 'Use an Ethiopian mobile number such as 0911223344'),
  );

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Query-string boolean: only the literal strings "true" and "false" are accepted. */
export const queryBooleanSchema = z.enum(['true', 'false']).transform((value) => value === 'true');

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details?: ApiErrorDetail[];
  requestId?: string;
}

export interface ApiSuccess<T, M = Record<string, unknown>> {
  success: true;
  data: T;
  error: null;
  meta: M;
}

export interface ApiFailure {
  success: false;
  data: null;
  error: ApiErrorBody;
  meta: Record<string, never>;
}

export type ApiResponse<T, M = Record<string, unknown>> = ApiSuccess<T, M> | ApiFailure;

export interface UploadedImage {
  publicId: string;
  url: string;
}
