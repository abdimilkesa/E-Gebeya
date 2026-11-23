import type { PublicProduct, PublicShopSummary } from '@marketplace/contracts';
import { screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type * as Config from '../../config';
import { mockApi, renderRoutes } from '../../test/utils';
import { HomeMapPage } from './HomeMapPage';

vi.mock('./ProductCard', () => ({
  ProductCard: ({ product }: { product: PublicProduct }) => <article>{product.name}</article>,
  ProductGrid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ProductGridSkeleton: () => <div>Loading recommendations</div>,
}));

vi.mock('../../config', async (importOriginal) => ({
  ...(await importOriginal<typeof Config>()),
  GOOGLE_MAPS_API_KEY: '',
  hasMapsKey: false,
}));

const shop = (name: string, slug: string, addressText: string): PublicShopSummary => ({
  id: `id-${slug}`,
  name,
  slug,
  addressText,
  latitude: '9.0108',
  longitude: '38.7613',
  productCount: 3,
  logoUrl: null,
  categories: [],
});

const product: PublicProduct = {
  id: 'product-1',
  name: 'Fresh Jimma Coffee',
  price: '350.00',
  currency: 'ETB',
  imageUrl: null,
  canPurchase: true,
  category: { slug: 'coffee-tea', name: 'Coffee & Tea' },
  shop: { id: 'shop-1', name: 'Abebe Coffee', slug: 'abebe-coffee' },
};

describe('home page without a Google Maps key', () => {
  it('explains the missing map and still lists every shop with its address', async () => {
    mockApi({
      'GET /shops': () => ({
        data: [
          shop('Abebe Coffee', 'abebe-coffee', 'Bole Road, Addis Ababa'),
          shop('Merkato Electronics', 'merkato-electronics', 'Merkato, Addis Ababa'),
        ],
        meta: { page: 1, pageSize: 200, total: 2, totalPages: 1 },
      }),
      'GET /categories': () => ({ data: [{ id: 'cat-1', name: 'Coffee', slug: 'coffee' }] }),
      'GET /products': () => ({
        data: [],
        meta: { page: 1, pageSize: 8, total: 0, totalPages: 0 },
      }),
    });

    renderRoutes([{ path: '/', element: <HomeMapPage /> }], '/');

    expect(await screen.findByText('Map preview is turned off')).toBeInTheDocument();
    const list = screen.getByRole('region', { name: 'Shop list' });
    expect(await within(list).findByText('Abebe Coffee')).toBeInTheDocument();
    expect(within(list).getByText('Bole Road, Addis Ababa')).toBeInTheDocument();
    expect(within(list).getByText('Merkato Electronics')).toBeInTheDocument();
    expect(within(list).getByText('2 shops')).toBeInTheDocument();
  });

  it('shows recently added, available products beneath the map', async () => {
    const apiMock = mockApi({
      'GET /shops': () => ({ data: [], meta: { page: 1, pageSize: 200, total: 0, totalPages: 0 } }),
      'GET /categories': () => ({ data: [] }),
      'GET /products': () => ({
        data: [product],
        meta: { page: 1, pageSize: 8, total: 1, totalPages: 1 },
      }),
    });

    renderRoutes([{ path: '/', element: <HomeMapPage /> }], '/');

    const recommendations = screen.getByRole('region', { name: 'Recommended products' });
    expect(await within(recommendations).findByText('Fresh Jimma Coffee')).toBeInTheDocument();
    expect(within(recommendations).getByRole('link', { name: 'Browse all' })).toHaveAttribute(
      'href',
      '/search',
    );
    expect(apiMock.callsTo('GET /products')[0]?.url.searchParams.get('available')).toBe('true');
    expect(apiMock.callsTo('GET /products')[0]?.url.searchParams.get('sort')).toBe('newest');
  });
});
