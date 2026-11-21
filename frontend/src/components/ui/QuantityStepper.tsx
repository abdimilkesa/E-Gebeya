import { MAX_CART_LINE_QUANTITY } from '@marketplace/contracts';
import { Minus, Plus } from 'lucide-react';
import { cn } from '../../lib/cn';

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = MAX_CART_LINE_QUANTITY,
  disabled,
  size = 'md',
  label = 'Quantity',
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  size?: 'sm' | 'md';
  label?: string;
}) {
  const button = cn(
    'flex items-center justify-center text-ink-700 transition-colors hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40',
    size === 'sm' ? 'size-8' : 'size-10',
  );
  return (
    <div className="inline-flex items-center overflow-hidden rounded-xl border border-ink-200 bg-white" role="group" aria-label={label}>
      <button
        type="button"
        className={button}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
      >
        <Minus className="size-4" />
      </button>
      <span
        className={cn('min-w-10 text-center text-sm font-semibold tabular-nums text-ink-950', size === 'sm' && 'min-w-8')}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        className={button}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
