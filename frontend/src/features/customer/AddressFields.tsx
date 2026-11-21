import {
  addressNameSchema,
  fullNameSchema,
  houseNumberSchema,
  mobilePhoneSchema,
} from '@marketplace/contracts';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { z } from 'zod';
import { Field, Input } from '../../components/ui/Form';

export const addressFieldsSchema = z.object({
  contactName: fullNameSchema,
  addressName: addressNameSchema,
  houseNumber: houseNumberSchema,
  phoneNumber: mobilePhoneSchema,
});
export type AddressFieldValues = z.input<typeof addressFieldsSchema>;
export const ADDRESS_FIELDS = ['contactName', 'addressName', 'houseNumber', 'phoneNumber'] as const;

/**
 * Recipient, place, house number and phone: the contact every shop in the order receives.
 * Works inside any form whose values include the four address fields.
 */
export function AddressFields<T extends AddressFieldValues>({
  register: registerAny,
  errors: errorsAny,
}: {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
}) {
  const register = registerAny as unknown as UseFormRegister<AddressFieldValues>;
  const errors = errorsAny as FieldErrors<AddressFieldValues>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Recipient name" required error={errors.contactName?.message}>
        {(field) => (
          <Input {...field} {...register('contactName')} autoComplete="name" invalid={!!errors.contactName} />
        )}
      </Field>
      <Field label="Phone number" required error={errors.phoneNumber?.message} hint="Shops call this number.">
        {(field) => (
          <Input
            {...field}
            {...register('phoneNumber')}
            type="tel"
            autoComplete="tel"
            placeholder="0911223344"
            invalid={!!errors.phoneNumber}
          />
        )}
      </Field>
      <Field
        label="Address"
        required
        error={errors.addressName?.message}
        hint="Area and a landmark, e.g. Mentina, near the mosque"
        className="sm:col-span-2"
      >
        {(field) => (
          <Input
            {...field}
            {...register('addressName')}
            autoComplete="street-address"
            invalid={!!errors.addressName}
          />
        )}
      </Field>
      <Field label="House number" required error={errors.houseNumber?.message}>
        {(field) => <Input {...field} {...register('houseNumber')} invalid={!!errors.houseNumber} />}
      </Field>
    </div>
  );
}
