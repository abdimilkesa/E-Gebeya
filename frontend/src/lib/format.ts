const etb = new Intl.NumberFormat('en-ET', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats an API money string ("1500.00") for display: "ETB 1,500.00". */
export function formatMoney(amount: string | number): string {
  const value = typeof amount === 'number' ? amount : Number(amount);
  return `ETB ${etb.format(Number.isFinite(value) ? value : 0)}`;
}

const dateTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const dateOnly = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));
export const formatDate = (iso: string): string => dateOnly.format(new Date(iso));

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
