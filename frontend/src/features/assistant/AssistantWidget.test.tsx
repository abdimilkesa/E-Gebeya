import type { AssistantChatResponse } from '@marketplace/contracts';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi, renderRoutes } from '../../test/utils';
import { AssistantWidget } from './AssistantWidget';

const reply: AssistantChatResponse = {
  reply: 'I found some shoes below 20,000 ETB.',
  products: [
    {
      productId: '11111111-1111-4111-8111-111111111111',
      name: 'Running shoes',
      description: 'Lightweight trainers',
      categoryName: 'Fashion',
      categorySlug: 'fashion',
      price: '12500.00',
      currency: 'ETB',
      imageUrl: null,
      inStock: true,
      shopId: '22222222-2222-4222-8222-222222222222',
      shopName: 'Near Shoes',
      shopSlug: 'near-shoes',
      addressText: 'Jimma center',
      distanceKm: '2.1',
    },
  ],
  shops: [
    {
      shopId: '22222222-2222-4222-8222-222222222222',
      name: 'Near Shoes',
      slug: 'near-shoes',
      description: null,
      addressText: 'Jimma center',
      phone: '0471112233',
      logoUrl: null,
      distanceKm: '2.1',
    },
  ],
};

describe('shopping assistant', () => {
  it('shows catalog cards from the assistant response and does not send a provider key', async () => {
    const api = mockApi({
      'POST /ai/chat': () => ({ data: reply }),
    });
    renderRoutes([{ path: '/', element: <AssistantWidget /> }], '/');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Market analyst' }));
    await user.click(screen.getByRole('button', { name: 'Find shoes below 20,000 ETB' }));

    expect(await screen.findByText('I found some shoes below 20,000 ETB.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Running shoes' })).toHaveAttribute(
      'href',
      '/products/11111111-1111-4111-8111-111111111111',
    );
    expect(screen.getByText(/ETB 12,500\.00/)).toBeInTheDocument();
    expect(screen.getAllByText(/2\.1 km away/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Available/)).toBeInTheDocument();

    const request = api.callsTo('POST /ai/chat')[0];
    expect(request?.body).toMatchObject({ message: 'Find shoes below 20,000 ETB', history: [] });
    expect(JSON.stringify(request?.body)).not.toMatch(/GEMINI|AIza|apiKey/);
  });
});
