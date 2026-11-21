import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../lib/cn';

const control =
  'block w-full rounded-xl border bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 transition-colors focus:outline-none focus:ring-2 focus:ring-accent-400/60 disabled:bg-ink-50 disabled:text-ink-500';

const controlState = (invalid?: boolean) =>
  invalid ? 'border-red-400 focus:border-red-500' : 'border-ink-200 focus:border-ink-400';

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode;
}

/** Label, control, hint and error message wired together for screen readers. */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink-800">
        {label}
        {required ? <span className="ml-0.5 text-red-600" aria-hidden="true">*</span> : null}
      </label>
      {children({
        id,
        ...(error ? { 'aria-invalid': true as const } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      })}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; ref?: Ref<HTMLInputElement> };

export function Input({ className, invalid, ...props }: InputProps) {
  return <input className={cn(control, controlState(invalid), 'h-10', className)} {...props} />;
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
};

export function Textarea({ className, invalid, rows = 4, ...props }: TextareaProps) {
  return <textarea rows={rows} className={cn(control, controlState(invalid), 'py-2', className)} {...props} />;
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
  ref?: Ref<HTMLSelectElement>;
};

export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <select className={cn(control, controlState(invalid), 'h-10 pr-8', className)} {...props}>
      {children}
    </select>
  );
}

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  description?: string;
  ref?: Ref<HTMLInputElement>;
};

export function Switch({ label, description, className, id, ...props }: SwitchProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <label htmlFor={inputId} className={cn('flex cursor-pointer items-start gap-3', className)}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={inputId} type="checkbox" className="peer sr-only" {...props} />
        <span className="h-6 w-11 rounded-full bg-ink-200 transition-colors peer-checked:bg-ink-950 peer-focus-visible:ring-2 peer-focus-visible:ring-accent-400 peer-disabled:opacity-50" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
      <span>
        <span className="block text-sm font-medium text-ink-900">{label}</span>
        {description ? <span className="block text-sm text-ink-500">{description}</span> : null}
      </span>
    </label>
  );
}

/** Form-level error banner (server errors that are not tied to one field). */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  );
}
