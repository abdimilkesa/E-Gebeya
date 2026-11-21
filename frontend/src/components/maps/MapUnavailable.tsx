import { MapPinOff } from 'lucide-react';
import { cn } from '../../lib/cn';

const MESSAGES = {
  'missing-key': {
    title: 'Map preview is turned off',
    body: 'Set VITE_GOOGLE_MAPS_API_KEY in .env to show the interactive map. Every shop is still listed with its address.',
  },
  'auth-failure': {
    title: 'Google Maps rejected the API key',
    body: 'Check that the key is valid, the Maps JavaScript API is enabled and this site is an allowed referrer.',
  },
  'load-failed': {
    title: 'The map could not load',
    body: 'Google Maps is unreachable right now. The shop list still works.',
  },
} as const;

export function MapUnavailable({
  reason,
  className,
}: {
  reason: keyof typeof MESSAGES;
  className?: string;
}) {
  const message = MESSAGES[reason];
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center gap-2 bg-ink-50 px-6 py-10 text-center',
        className,
      )}
    >
      <span className="rounded-2xl bg-white p-3 text-ink-400 shadow-card">
        <MapPinOff className="size-6" />
      </span>
      <p className="text-sm font-semibold text-ink-900">{message.title}</p>
      <p className="max-w-sm text-sm text-ink-500">{message.body}</p>
    </div>
  );
}
