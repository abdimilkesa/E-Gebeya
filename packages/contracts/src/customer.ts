import { z } from 'zod';
import { fullNameSchema } from './auth.js';
import { mobilePhoneSchema } from './common.js';

export const MAX_SAVED_ADDRESSES = 10;

export const addressNameSchema = z
  .string()
  .trim()
  .min(2, 'Address must be at least 2 characters')
  .max(120, 'Address must be at most 120 characters');

export const houseNumberSchema = z
  .string()
  .trim()
  .min(1, 'Enter a house number')
  .max(60, 'House number must be at most 60 characters');

/**
 * Who receives an order and where. Checkout copies these values onto the order, so later
 * edits to a saved address never change a placed order. `contactName` defaults to the
 * customer's full name.
 */
export const deliveryContactSchema = z.strictObject({
  contactName: fullNameSchema.optional(),
  addressName: addressNameSchema,
  houseNumber: houseNumberSchema,
  phoneNumber: mobilePhoneSchema,
});
export type DeliveryContactInput = z.infer<typeof deliveryContactSchema>;

export const createAddressSchema = deliveryContactSchema.extend({
  isDefault: z.boolean().optional(),
});
export type CreateAddressInput = z.infer<typeof createAddressSchema>;

export const updateAddressSchema = createAddressSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Change at least one field',
  });
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;

export interface CustomerProfile {
  id: string;
  fullName: string;
  username: string;
}

export interface DeliveryContact {
  contactName: string;
  addressName: string;
  houseNumber: string;
  phoneNumber: string;
}

export interface CustomerAddress extends DeliveryContact {
  id: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
