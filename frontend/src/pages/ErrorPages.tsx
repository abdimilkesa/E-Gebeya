import { Compass, TriangleAlert } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { ButtonLink, buttonClasses } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <span className="mb-5 rounded-2xl bg-accent-100 p-3 text-accent-800">
        <Compass className="size-7" />
      </span>
      <h1 className="text-2xl font-semibold text-ink-950">Page not found</h1>
      <p className="mt-2 text-sm text-ink-500">The page you are looking for does not exist or has moved.</p>
      <ButtonLink to="/" className="mt-6">
        Back to the map
      </ButtonLink>
    </div>
  );
}

/** Last-resort boundary for errors thrown while rendering a route. */
export function RouteErrorPage() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  if (notFound) return <NotFoundPage />;
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="mb-5 rounded-2xl bg-red-50 p-3 text-red-600">
        <TriangleAlert className="size-7" />
      </span>
      <h1 className="text-2xl font-semibold text-ink-950">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-500">
        An unexpected error stopped this page from loading. Reloading usually fixes it.
      </p>
      <div className="mt-6 flex gap-2">
        <button type="button" className={buttonClasses('primary')} onClick={() => window.location.reload()}>
          Reload page
        </button>
        <a href="/" className={buttonClasses('secondary')}>
          Go home
        </a>
      </div>
    </div>
  );
}
