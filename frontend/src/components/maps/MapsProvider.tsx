import { APIProvider, APILoadingStatus, useApiLoadingStatus } from '@vis.gl/react-google-maps';
import type { ReactNode } from 'react';
import { GOOGLE_MAPS_API_KEY, hasMapsKey } from '../../config';
import { MapUnavailable } from './MapUnavailable';

/**
 * Loads the Maps JavaScript API with the browser key. The key is public by design and must be
 * restricted to this site's HTTP referrers in Google Cloud; no server secret is involved.
 */
export function MapsProvider({ children, className }: { children: ReactNode; className?: string }) {
  if (!hasMapsKey) return <MapUnavailable reason="missing-key" className={className} />;
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['marker']}>
      <MapLoadGuard className={className}>{children}</MapLoadGuard>
    </APIProvider>
  );
}

function MapLoadGuard({ children, className }: { children: ReactNode; className?: string }) {
  const status = useApiLoadingStatus();
  if (status === APILoadingStatus.AUTH_FAILURE) return <MapUnavailable reason="auth-failure" className={className} />;
  if (status === APILoadingStatus.FAILED) return <MapUnavailable reason="load-failed" className={className} />;
  return children;
}
