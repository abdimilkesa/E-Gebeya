import { ImageOff, Package } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/cn';

/** Image that degrades to a neutral placeholder when there is no URL or it fails to load. */
export function ImageWithFallback({
  src,
  alt,
  className,
  iconClassName,
  eager = false,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  iconClassName?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    const Icon = failed ? ImageOff : Package;
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn('flex items-center justify-center bg-gradient-to-br from-ink-50 to-ink-100 text-ink-300', className)}
      >
        <Icon className={cn('size-8', iconClassName)} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
}
