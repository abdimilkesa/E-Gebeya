import type { CheckoutQuote, CustomerAddress } from '@marketplace/contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mockApi, renderRoutes } from '../../test/utils';
import { CheckoutPage } from './CheckoutPage';

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    ready: true,
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      fullName: 'Hana Tesfaye',
      username: 'hana',
      mustChangePassword: false,
    },
  }),
}));

const SAVED_ADDRESS: CustomerAddress = {
  id: 'address-1',
  contactName: 'Hana Tesfaye',
  addressName: 'Bole, near Edna Mall',
  houseNumber: '12',
  phoneNumber: '0911223344',
  isDefault: true,
  createdAt: '2026-11-01T08:00:00.000Z',
  updatedAt: '2026-11-01T08:00:00.000Z',
};

const QUOTE: CheckoutQuote = {
  fulfillmentPreference: 'DELIVERY',
  currency: 'ETB',
  shops: [
    {
      shopId: 'shop-1',
      shopName: 'Abebe Coffee',
      shopSlug: 'abebe-coffee',
      items: [
        {
          cartItemId: 'line-1',
          productId: 'product-1',
          name: 'Yirgacheffe beans',
          imageUrl: null,
          unitPrice: '450.00',
          quantity: 2,
          lineTotal: '900.00',
          issue: null,
        },
      ],
      subtotal: '900.00',
      deliveryFee: '50.00',
      total: '950.00',
    },
  ],
  merchandiseSubtotal: '900.00',
  deliveryFeeTotal: '50.00',
  grandTotal: '950.00',
  canCheckout: true,
  issues: [],
  paymentMethods: ['BANK_TRANSFER'],
};

const ROUTES = [
  { path: '/checkout', element: <CheckoutPage /> },
  { path: '/account/orders/:orderId', element: <p>Order confirmation</p> },
];

const placed = { status: 201, data: { order: { id: 'order-1' }, chapa: null } };

async function readyButton() {
  const button = await screen.findByRole('button', { name: 'Place order' });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

describe('checkout page', () => {
  it('places a bank-transfer order for the default saved address with an idempotency key', async () => {
    const api = mockApi({
      'POST /checkout/quote': () => ({ data: QUOTE }),
      'GET /customers/me/addresses': () => ({ data: [SAVED_ADDRESS] }),
      'POST /checkout': () => placed,
    });
    renderRoutes(ROUTES, '/checkout');

    const button = await readyButton();
    expect(screen.getByRole('radio', { name: /Bole, near Edna Mall/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Chapa/ })).toBeDisabled();
    expect(screen.getByText('Not available yet.')).toBeInTheDocument();

    await userEvent.click(button);

    expect(await screen.findByText('Order confirmation')).toBeInTheDocument();
    const [request] = api.callsTo('POST /checkout');
    expect(request?.body).toEqual({
      fulfillmentPreference: 'DELIVERY',
      paymentMethod: 'BANK_TRANSFER',
      addressId: 'address-1',
    });
    expect(request?.headers['Idempotency-Key']).toMatch(/^[A-Za-z0-9_-]{8,80}$/);
  });

  it('requires a complete new address when none is saved', async () => {
    const api = mockApi({
      'POST /checkout/quote': () => ({ data: QUOTE }),
      'GET /customers/me/addresses': () => ({ data: [] }),
      'POST /checkout': () => placed,
    });
    renderRoutes(ROUTES, '/checkout');
    const user = userEvent.setup();

    const button = await readyButton();
    expect(screen.getByLabelText(/Recipient name/)).toHaveValue('Hana Tesfaye');

    await user.click(button);
    expect(await screen.findByText('Address must be at least 2 characters')).toBeInTheDocument();
    expect(screen.getByText('Enter a house number')).toBeInTheDocument();
    expect(api.callsTo('POST /checkout')).toHaveLength(0);

    await user.type(screen.getByLabelText(/^Address/), 'Mentina, near the mosque');
    await user.type(screen.getByLabelText(/House number/), '7');
    await user.type(screen.getByLabelText(/Phone number/), '0911223344');
    await user.click(button);

    expect(await screen.findByText('Order confirmation')).toBeInTheDocument();
    expect(api.callsTo('POST /checkout')[0]?.body).toEqual({
      fulfillmentPreference: 'DELIVERY',
      paymentMethod: 'BANK_TRANSFER',
      contactName: 'Hana Tesfaye',
      addressName: 'Mentina, near the mosque',
      houseNumber: '7',
      phoneNumber: '0911223344',
      saveAddress: true,
    });
  });

  it('retries with the same key after a dropped connection and a new key after a rejection', async () => {
    let attempts = 0;
    const api = mockApi({
      'POST /checkout/quote': () => ({ data: QUOTE }),
      'GET /customers/me/addresses': () => ({ data: [SAVED_ADDRESS] }),
      'POST /checkout': () => {
        attempts += 1;
        if (attempts === 1) throw new TypeError('Failed to fetch');
        if (attempts === 2) {
          return {
            status: 422,
            error: { code: 'BUSINESS_RULE', message: 'There is not enough stock of Yirgacheffe beans.' },
          };
        }
        return placed;
      },
    });
    renderRoutes(ROUTES, '/checkout');
    const user = userEvent.setup();

    await user.click(await readyButton());
    expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument();

    await user.click(await readyButton());
    expect(await screen.findByText('There is not enough stock of Yirgacheffe beans.')).toBeInTheDocument();
    await waitFor(() => expect(api.callsTo('POST /checkout/quote')).toHaveLength(2));

    await user.click(await readyButton());
    expect(await screen.findByText('Order confirmation')).toBeInTheDocument();

    const keys = api.callsTo('POST /checkout').map((request) => request.headers['Idempotency-Key']);
    expect(keys).toHaveLength(3);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
  });
});
