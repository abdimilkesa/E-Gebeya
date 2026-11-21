import type { PublicShopSummary } from '@marketplace/contracts';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type * as Config from '../../config';
import { mockApi, renderRoutes } from '../../test/utils';
import { HomeMapPage } from './HomeMapPage';

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
    });

    renderRoutes([{ path: '/', element: <HomeMapPage /> }], '/');

    expect(await screen.findByText('Map preview is turned off')).toBeInTheDocument();
    const list = screen.getByRole('region', { name: 'Shop list' });
    expect(await within(list).findByText('Abebe Coffee')).toBeInTheDocument();
    expect(within(list).getByText('Bole Road, Addis Ababa')).toBeInTheDocument();
    expect(within(list).getByText('Merkato Electronics')).toBeInTheDocument();
    expect(within(list).getByText('2 shops')).toBeInTheDocument();
  });
});
