import type { AuthUser, UserRole } from '@marketplace/contracts';
import { describe, expect, it } from 'vitest';
import { returnPathFor } from './LoginPage';

const userWith = (role: UserRole, mustChangePassword = false): AuthUser => ({
  id: '00000000-0000-4000-8000-000000000001',
  role,
  status: 'ACTIVE',
  fullName: 'Test User',
  username: 'test_user',
  mustChangePassword,
});

describe('returnPathFor', () => {
  it('only follows same-site paths', () => {
    const customer = userWith('CUSTOMER');
    expect(returnPathFor(customer, '//evil.example/phish')).toBe('/');
    expect(returnPathFor(customer, 'https://evil.example')).toBe('/');
    expect(returnPathFor(customer, undefined)).toBe('/');
    expect(returnPathFor(customer, '/shops/abebe-coffee')).toBe('/shops/abebe-coffee');
  });

  it('sends each role only to areas it may open', () => {
    expect(returnPathFor(userWith('CUSTOMER'), '/checkout')).toBe('/checkout');
    expect(returnPathFor(userWith('CUSTOMER'), '/account/orders/abc')).toBe('/account/orders/abc');
    expect(returnPathFor(userWith('CUSTOMER'), '/admin/shops')).toBe('/');
    expect(returnPathFor(userWith('MERCHANT'), '/checkout')).toBe('/merchant');
    expect(returnPathFor(userWith('MERCHANT'), '/account/addresses')).toBe('/merchant');
    expect(returnPathFor(userWith('SUPER_ADMIN'), '/account/orders')).toBe('/admin');
    expect(returnPathFor(userWith('SUPER_ADMIN'), '/admin/shops')).toBe('/admin/shops');
  });

  it('forces a temporary password to be replaced first', () => {
    expect(returnPathFor(userWith('MERCHANT', true), '/merchant/products')).toBe('/account/change-password');
  });
});
