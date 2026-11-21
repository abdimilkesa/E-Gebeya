import { Link } from 'react-router';
import { APP_NAME } from '../../config';
import { cn } from '../../lib/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#0B0B0F" />
      <path
        d="M16 6c-4.4 0-8 3.4-8 7.7 0 5.6 6.7 11.6 7.4 12.2.3.3.9.3 1.2 0 .7-.6 7.4-6.6 7.4-12.2C24 9.4 20.4 6 16 6Z"
        fill="#F0B429"
      />
      <circle cx="16" cy="13.6" r="3.2" fill="#0B0B0F" />
    </svg>
  );
}

export function Logo({ to = '/', className, suffix }: { to?: string; className?: string; suffix?: string }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2.5', className)} aria-label={`${APP_NAME} home`}>
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight text-ink-950">
        {APP_NAME}
        {suffix ? <span className="ml-1.5 font-normal text-ink-500">{suffix}</span> : null}
      </span>
    </Link>
  );
}
