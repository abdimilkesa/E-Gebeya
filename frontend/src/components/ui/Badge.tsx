import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent' | 'info';
type Tone = BadgeTone;

const tones: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  danger: 'bg-red-50 text-red-800 ring-red-600/20',
  accent: 'bg-accent-100 text-accent-900 ring-accent-600/20',
  info: 'bg-sky-50 text-sky-800 ring-sky-600/20',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusTones: Record<string, Tone> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  REMOVED: 'danger',
  ARCHIVED: 'neutral',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  REMOVED: 'Removed',
  ARCHIVED: 'Archived',
};

/** Status pill for shops, products and accounts. */
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTones[status] ?? 'neutral'}>{statusLabels[status] ?? status}</Badge>;
}
