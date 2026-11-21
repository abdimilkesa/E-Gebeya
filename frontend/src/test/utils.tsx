import type { ErrorCode, PageMeta } from '@marketplace/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast';

interface MockRequest {
  url: URL;
  body: unknown;
  headers: Record<string, string>;
}

type MockResponse =
  | { status?: number; data: unknown; meta?: PageMeta }
  | { status: number; error: { code: ErrorCode; message: string } };

/**
 * Replaces `fetch` with handlers keyed by "METHOD /path" (path after /api/v1, no query).
 * A handler that throws behaves like a dropped connection.
 */
export function mockApi(handlers: Record<string, (request: MockRequest) => MockResponse>) {
  const calls: { key: string; request: MockRequest }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), 'http://localhost');
      const key = `${init.method ?? 'GET'} ${url.pathname.replace(/^\/api\/v1/, '')}`;
      const request = {
        url,
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
        headers: { ...(init.headers as Record<string, string>) },
      };
      calls.push({ key, request });
      const handler = handlers[key];
      const result: MockResponse = handler
        ? handler(request)
        : { status: 404, error: { code: 'NOT_FOUND', message: `No mock for ${key}` } };
      const body =
        'error' in result
          ? { success: false, error: result.error }
          : { success: true, data: result.data, meta: result.meta ?? {} };
      return new Response(JSON.stringify(body), {
        status: result.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return { callsTo: (key: string) => calls.filter((call) => call.key === key).map((call) => call.request) };
}

export function renderRoutes(routes: RouteObject[], initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { router, queryClient };
}
