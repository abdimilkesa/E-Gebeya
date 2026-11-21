import type { ReactNode } from 'react';
import { LogoMark } from '../../components/layout/Logo';

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex justify-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark className="mb-4 size-11" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink-950">{title}</h1>
          {description ? <p className="mt-1.5 text-sm text-ink-500">{description}</p> : null}
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card sm:p-8">{children}</div>
        {footer ? <div className="mt-5 text-center text-sm text-ink-600">{footer}</div> : null}
      </div>
    </div>
  );
}
