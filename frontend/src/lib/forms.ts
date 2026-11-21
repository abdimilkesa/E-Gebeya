import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError, errorMessage } from './api';

/**
 * Puts server validation messages on the matching form fields. Returns a message for the
 * form-level banner when the error is not about specific fields, otherwise null.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  if (!(error instanceof ApiError)) return errorMessage(error);
  const messages = error.fieldErrors();
  let matched = false;
  for (const field of fields) {
    const message = messages[field];
    if (message) {
      setError(field, { type: 'server', message });
      matched = true;
    }
  }
  return matched ? null : error.message;
}

/** Turns an empty input into undefined so optional fields are omitted rather than sent as "". */
export function blankToUndefined(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
