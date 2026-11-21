import { type ZodType, z } from 'zod';
import type { AssistantProductCard, AssistantShopCard } from '@marketplace/contracts';
import { uuidSchema } from '@marketplace/contracts';
import {
  comparePublicProducts,
  findNearbyPublicShops,
  getPublicProductForAssistant,
  getPublicShopForAssistant,
  searchPublicProducts,
  type NearbyShopGroup,
} from '../catalog/assistant-catalog.service.js';

/**
 * Allowlist of catalog tools. Anything else the model names is rejected here.
 * This module does not import Prisma. Coordinates, when the shopper shared them,
 * arrive on `origin` from the HTTP handler and are never accepted as tool arguments.
 */

export const ASSISTANT_TOOL_NAMES = [
  'searchProducts',
  'getProductDetails',
  'getShopDetails',
  'findNearbyShops',
  'compareProducts',
  'analyzeMarket',
] as const;

export type AssistantToolName = (typeof ASSISTANT_TOOL_NAMES)[number];

export interface ToolContext {
  origin: { latitude: number; longitude: number } | null;
}

const optionalText = z
  .string()
  .trim()
  .min(1, 'Search text must be 1–100 characters.')
  .max(100, 'Search text must be 1–100 characters.')
  .nullish()
  .transform((value) => value ?? undefined);

const optionalCategory = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Category must be a public category slug.')
  .max(80)
  .nullish()
  .transform((value) => value ?? undefined);

const optionalPrice = z
  .number()
  .nonnegative('Price cannot be negative.')
  .max(99_999_999, 'Price is too large.')
  .nullish()
  .transform((value) => value ?? undefined);

const limitSchema = z
  .number()
  .int('Limit must be a whole number.')
  .min(1, 'Limit must be at least 1.')
  .max(10, 'Limit must be at most 10.')
  .nullish()
  .transform((value) => value ?? 10);

const searchSchema = z
  .strictObject({
    query: optionalText,
    category: optionalCategory,
    minPrice: optionalPrice,
    maxPrice: optionalPrice,
    availableOnly: z
      .boolean()
      .nullish()
      .transform((value) => value ?? true),
    limit: limitSchema,
  })
  .refine(
    (value) => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice,
    { message: 'Minimum price cannot be above the maximum price.', path: ['minPrice'] },
  );

const nearbySchema = z
  .strictObject({
    query: optionalText,
    category: optionalCategory,
    maxPrice: optionalPrice,
    radiusKm: z
      .number()
      .gt(0, 'Radius must be greater than 0.')
      .max(50, 'Radius must be at most 50 km.')
      .nullish()
      .transform((value) => value ?? 15),
    limit: limitSchema,
  });

const productSchema = z.strictObject({ productId: uuidSchema });
const shopSchema = z.strictObject({ shopId: uuidSchema });
const compareSchema = z.strictObject({
  productIds: z
    .array(uuidSchema)
    .min(2, 'Compare at least two products.')
    .max(3, 'Compare at most three products.'),
});

const analyzeSchema = searchSchema.refine((value) => value.query !== undefined || value.category !== undefined, {
  message: 'Name a product or a category to analyze.',
});

const DATA_GAPS = [
  'Seller ratings are not stored.',
  'Customer reviews are not stored.',
  'Past prices are not stored, so no price trend is available.',
];

function toCents(price: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(price);
  if (!match) return null;
  const whole = Number(match[1]);
  const frac = Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(frac)) return null;
  return whole * 100 + frac;
}

function fromCents(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const frac = String(Math.abs(cents % 100)).padStart(2, '0');
  return `${whole}.${frac}`;
}

function point(product: AssistantProductCard): MarketPricePoint {
  return { name: product.name, price: product.price, shopName: product.shopName };
}

/** Price bands and the average use only the listings passed in. Nothing is filled in from outside the catalog. */
export function buildMarketAnalysis(products: AssistantProductCard[]): MarketAnalysis {
  const purchasable = products.filter((product) => product.inStock);
  const priced = purchasable.flatMap((product) => {
    const cents = toCents(product.price);
    return cents === null ? [] : [{ product, cents }];
  });
  const sorted = [...priced].sort((left, right) => left.cents - right.cents || left.product.name.localeCompare(right.product.name));
  const sellers = new Set(products.map((product) => product.shopId));
  const count = sorted.length;
  const lowest = sorted[0];
  const highest = sorted[count - 1];
  const enoughForAverage = count >= 2;
  const enoughForBands = count >= 3;
  const bandSize = Math.floor(count / 3);
  const label = (entry: (typeof sorted)[number]) =>
    `${entry.product.name} at ${entry.product.shopName} for ${entry.product.price} ETB`;

  return {
    currency: 'ETB',
    matchedCount: products.length,
    purchasableCount: count,
    sellerCount: sellers.size,
    singleSeller: sellers.size === 1,
    averagePrice: enoughForAverage
      ? fromCents(Math.round(sorted.reduce((sum, entry) => sum + entry.cents, 0) / count))
      : null,
    averageNote: enoughForAverage
      ? 'Average of the purchasable prices in this result only.'
      : count === 1
        ? 'One purchasable listing is not enough for an average.'
        : 'No purchasable listing, so there is no average.',
    lowestPurchasable: lowest ? point(lowest.product) : null,
    highestPurchasable: highest && count > 1 ? point(highest.product) : null,
    affordable: enoughForBands ? sorted.slice(0, bandSize).map(label) : [],
    typical: enoughForBands ? sorted.slice(bandSize, count - bandSize).map(label) : [],
    expensive: enoughForBands ? sorted.slice(count - bandSize).map(label) : [],
    bandNote: enoughForBands
      ? 'Affordable, typical, and expensive are the low, middle, and high thirds of these purchasable listings.'
      : 'Fewer than three purchasable listings, so they are not split into affordable, typical, and expensive.',
    unusualGap:
      count >= 2 && lowest && highest && highest.cents >= lowest.cents * 3
        ? {
            lowestPrice: lowest.product.price,
            highestPrice: highest.product.price,
            highestIsTimesLowest: (highest.cents / lowest.cents).toFixed(1),
          }
        : null,
    missingDescriptions: products.filter((product) => !product.description).length,
    missingImages: products.filter((product) => !product.imageUrl).length,
    unavailableNames: products.filter((product) => !product.inStock).map((product) => product.name),
    priceHistory: null,
    sellerRatings: null,
    customerReviews: null,
    dataGaps: DATA_GAPS,
    asOf: new Date().toISOString(),
  };
}

/** Every current public listing, read at the moment of the call. */
export async function loadLiveMarket(): Promise<ToolPayload> {
  const products = await searchPublicProducts({ availableOnly: false, limit: 30 });
  return scrubForModel({ products, analysis: buildMarketAnalysis(products) }) as ToolPayload;
}

export interface MarketPricePoint {
  name: string;
  price: string;
  shopName: string;
}

/** Figures computed from the listings in one catalog search. Null means the catalog does not have that fact. */
export interface MarketAnalysis {
  currency: 'ETB';
  matchedCount: number;
  purchasableCount: number;
  sellerCount: number;
  singleSeller: boolean;
  averagePrice: string | null;
  averageNote: string;
  lowestPurchasable: MarketPricePoint | null;
  highestPurchasable: MarketPricePoint | null;
  affordable: string[];
  typical: string[];
  expensive: string[];
  bandNote: string;
  unusualGap: { lowestPrice: string; highestPrice: string; highestIsTimesLowest: string } | null;
  missingDescriptions: number;
  missingImages: number;
  unavailableNames: string[];
  priceHistory: null;
  sellerRatings: null;
  customerReviews: null;
  dataGaps: string[];
  /** When this snapshot was read from the catalog. */
  asOf: string;
}

export interface ToolPayload {
  products?: AssistantProductCard[];
  shops?: AssistantShopCard[];
  product?: AssistantProductCard | null;
  shop?: AssistantShopCard | null;
  groups?: NearbyShopGroup[];
  analysis?: MarketAnalysis;
  error?: string;
  message?: string;
}

const FORBIDDEN_KEYS = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'bankAccountNumber',
  'bank_account_number',
  'bankName',
  'bank_name',
  'bankAccountName',
  'bank_account_name',
  'token',
  'accessToken',
  'refreshToken',
  'databaseUrl',
  'DATABASE_URL',
  'latitude',
  'longitude',
  'shop_latitude',
  'shop_longitude',
  'email',
  'username',
  'tokenVersion',
  'sql',
  'queryRaw',
]);

/** Drops anything that must not be shown to the model, even if a query starts returning it. */
export function scrubForModel(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubForModel);
  if (value && typeof value === 'object') {
    const copy: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      copy[key] = scrubForModel(child);
    }
    return copy;
  }
  return value;
}

function invalid(message: string): ToolPayload {
  return { error: 'INVALID_ARGUMENTS', message };
}

async function runSchema<T>(schema: ZodType<T>, args: unknown, run: (value: T) => Promise<ToolPayload>) {
  const parsed = schema.safeParse(args ?? {});
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? 'Invalid arguments.');
  return scrubForModel(await run(parsed.data)) as ToolPayload;
}

const handlers: Record<AssistantToolName, (args: unknown, context: ToolContext) => Promise<ToolPayload>> = {
  searchProducts: (args) =>
    runSchema(searchSchema, args, async (value) => ({
      products: await searchPublicProducts(value),
    })),
  getProductDetails: (args) =>
    runSchema(productSchema, args, async (value) => ({
      product: await getPublicProductForAssistant(value.productId),
    })),
  getShopDetails: (args) =>
    runSchema(shopSchema, args, async (value) => ({
      shop: await getPublicShopForAssistant(value.shopId),
    })),
  findNearbyShops: (args, context) =>
    runSchema(nearbySchema, args, async (value) => {
      if (!context.origin) {
        return {
          error: 'LOCATION_UNAVAILABLE',
          message: 'The shopper has not shared a location. Do not guess a distance.',
          groups: [],
        };
      }
      const groups = await findNearbyPublicShops({ ...value, origin: context.origin, availableOnly: true });
      return { groups };
    }),
  compareProducts: (args) =>
    runSchema(compareSchema, args, async (value) => ({
      products: await comparePublicProducts(value.productIds),
    })),
  analyzeMarket: (args) =>
    runSchema(analyzeSchema, args, async (value) => {
      const products = await searchPublicProducts({ ...value, availableOnly: false });
      return { products, analysis: buildMarketAnalysis(products) };
    }),
};

export function isAllowlistedTool(name: string): name is AssistantToolName {
  return Object.hasOwn(handlers, name);
}

export async function dispatchTool(name: string, args: unknown, context: ToolContext): Promise<ToolPayload> {
  if (!isAllowlistedTool(name)) {
    return { error: 'UNKNOWN_TOOL', message: 'That action is not available.' };
  }
  return handlers[name](args, context);
}

export const TOOL_DECLARATIONS = [
  {
    name: 'searchProducts',
    description:
      'Search the public product catalog. Returns names, prices, shops, and whether each product can be bought. Does not return stock counts or private data.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Product words to match, 1–100 characters.' },
        category: { type: 'STRING', description: 'Public category slug, such as fashion.' },
        minPrice: { type: 'NUMBER', description: 'Minimum price in ETB.' },
        maxPrice: { type: 'NUMBER', description: 'Maximum price in ETB.' },
        availableOnly: { type: 'BOOLEAN', description: 'When true, only purchasable products. Defaults to true.' },
        limit: { type: 'INTEGER', description: 'How many products to return, from 1 to 10.' },
      },
    },
  },
  {
    name: 'getProductDetails',
    description: 'Public details for one product id from the catalog.',
    parameters: {
      type: 'OBJECT',
      properties: { productId: { type: 'STRING', description: 'Product id.' } },
      required: ['productId'],
    },
  },
  {
    name: 'getShopDetails',
    description: 'Public shop name, description, address, phone, and logo. No bank or login data.',
    parameters: {
      type: 'OBJECT',
      properties: { shopId: { type: 'STRING', description: 'Shop id.' } },
      required: ['shopId'],
    },
  },
  {
    name: 'findNearbyShops',
    description:
      'Find public shops selling matching products, sorted by distance. Do not pass coordinates. The server applies the shopper location when they shared it.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Product words, such as shoes.' },
        category: { type: 'STRING', description: 'Public category slug.' },
        maxPrice: { type: 'NUMBER', description: 'Maximum price in ETB.' },
        radiusKm: { type: 'NUMBER', description: 'Search radius in kilometres, at most 50.' },
        limit: { type: 'INTEGER', description: 'How many shops to return, from 1 to 10.' },
      },
    },
  },
  {
    name: 'analyzeMarket',
    description:
      'Compare current public prices for a product or category. Returns each listing plus verified counts, the average when at least two can be bought, and explicit nulls for ratings, reviews, and price history. Do not replace those nulls with estimates.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Product words to match, 1–100 characters.' },
        category: { type: 'STRING', description: 'Public category slug, such as groceries.' },
        minPrice: { type: 'NUMBER', description: 'Minimum price in ETB.' },
        maxPrice: { type: 'NUMBER', description: 'Maximum price in ETB.' },
        limit: { type: 'INTEGER', description: 'How many listings to include, from 1 to 10.' },
      },
    },
  },
  {
    name: 'compareProducts',
    description: 'Compare two or three public products by their catalog price, category, description, and shop.',
    parameters: {
      type: 'OBJECT',
      properties: {
        productIds: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Two or three product ids.',
        },
      },
      required: ['productIds'],
    },
  },
] as const;
