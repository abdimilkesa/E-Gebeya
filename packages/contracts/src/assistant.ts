import { z } from 'zod';

/**
 * Shopping assistant request. Unknown properties are dropped, including anything a
 * caller adds to look like a system instruction, a user id, or a database query.
 * Coordinates stay on this request so the backend can measure distance. They are
 * not a tool argument and are not forwarded to the model.
 */
export const assistantChatSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1, 'Enter a question.')
      .max(500, 'Keep the question under 500 characters.'),
    history: z
      .array(
        z
          .object({
            role: z.enum(['user', 'assistant']),
            text: z.string().trim().min(1).max(500),
          })
          .strip(),
      )
      .max(10, 'Send at most 10 earlier messages.')
      .optional()
      .default([]),
    location: z
      .strictObject({
        latitude: z.number().gte(-90).lte(90),
        longitude: z.number().gte(-180).lte(180),
      })
      .nullable()
      .optional(),
  })
  .strip();

export type AssistantChatInput = z.infer<typeof assistantChatSchema>;

/** Public product card. Every field is already on the public catalog. */
export interface AssistantProductCard {
  productId: string;
  name: string;
  description: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  price: string;
  currency: 'ETB';
  imageUrl: string | null;
  inStock: boolean;
  shopId: string;
  shopName: string;
  shopSlug: string;
  addressText: string;
  /** Set only when the backend measured distance. Never a raw coordinate. */
  distanceKm: string | null;
}

/** Public shop card. Bank details, merchant login, and coordinates are not on it. */
export interface AssistantShopCard {
  shopId: string;
  name: string;
  slug: string;
  description: string | null;
  addressText: string;
  phone: string | null;
  logoUrl: string | null;
  distanceKm: string | null;
}

export interface AssistantChatResponse {
  reply: string;
  products: AssistantProductCard[];
  shops: AssistantShopCard[];
}
