import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mockApi, renderRoutes } from '../../test/utils';
import { MarketPosition } from './MarketPosition';

describe('MarketPosition', () => {
  it('compares the merchant product with the current catalog', async () => {
    mockApi({
      'GET /merchant/products': () => ({
        data: [
          {
            id: 'own-1',
            shopId: 'shop-a',
            shopName: 'rytyg',
            category: { id: 'c1', name: 'Health & Beauty', slug: 'health-beauty' },
            name: 'cxcxv',
            description: '',
            price: '34.00',
            stockQuantity: 3,
            isAvailable: true,
            status: 'ACTIVE',
            imageUrl: null,
            images: [],
            createdAt: '2026-11-21T00:00:00.000Z',
            updatedAt: '2026-11-21T00:00:00.000Z',
          },
        ],
        meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
      }),
      'GET /products': () => ({
        data: [
          {
            id: 'own-1',
            name: 'cxcxv',
            price: '34.00',
            currency: 'ETB',
            imageUrl: null,
            canPurchase: true,
            category: { slug: 'health-beauty', name: 'Health & Beauty' },
            shop: { id: 'shop-a', name: 'rytyg', slug: 'rytyg' },
          },
        ],
        meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
      }),
    });

    renderRoutes([{ path: '/', element: <MarketPosition shopIds={['shop-a']} /> }], '/');

    expect(await screen.findByRole('heading', { name: 'Your prices against the market' })).toBeInTheDocument();
    expect(screen.getByText('cxcxv')).toBeInTheDocument();
    expect(screen.getByText('Only seller')).toBeInTheDocument();
    expect(screen.getByText('No other shop has a buyable product in Health & Beauty right now.')).toBeInTheDocument();
  });
});
