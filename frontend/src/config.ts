/** Display name used across the UI. Change it here to rebrand. */
export const APP_NAME = 'Gebeya';
export const APP_TAGLINE = 'Local shops, one checkout';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api/v1';

/** Browser key restricted by HTTP referrer. Optional: without it the app shows a list instead of a map. */
export const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '';

export const GOOGLE_MAPS_MAP_ID =
  (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) || 'DEMO_MAP_ID';

export const hasMapsKey = GOOGLE_MAPS_API_KEY.length > 0;
