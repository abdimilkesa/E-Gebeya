import type { PaymentMethod } from '@marketplace/contracts';

/**
 * Methods checkout accepts. Bank transfer needs no payment provider. Chapa is not offered
 * because the provider integration (initialize, verify, webhook) is not built yet.
 */
export function availablePaymentMethods(): PaymentMethod[] {
  return ['BANK_TRANSFER'];
}
