import { zodResolver } from '@hookform/resolvers/zod';
import {
  IDEMPOTENCY_HEADER,
  PAYMENT_METHODS,
  type CheckoutQuote,
  type CheckoutResult,
  type CustomerAddress,
  type FulfillmentPreference,
  type PaymentMethod,
} from '@marketplace/contracts';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, Info, Landmark, MapPin, PackageCheck, Store, Truck } from 'lucide-react';
import { useRef, useState, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { useAuth } from '../../auth/AuthProvider';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { Field, FormError, Switch, Textarea } from '../../components/ui/Form';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { ApiError, api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format';
import { applyServerErrors, blankToUndefined } from '../../lib/forms';
import { ADDRESS_FIELDS, AddressFields, addressFieldsSchema } from '../customer/AddressFields';
import { customerKeys, useAddresses } from '../customer/queries';
import { LineIssueBadge } from './LineIssueBadge';

const FULFILLMENT_OPTIONS: { value: FulfillmentPreference; title: string; description: string; icon: typeof Truck }[] = [
  { value: 'DELIVERY', title: 'Delivery', description: 'Each shop delivers its part. Shop delivery fees apply.', icon: Truck },
  { value: 'PICKUP', title: 'Pickup', description: 'Collect from each shop yourself. No delivery fees.', icon: PackageCheck },
];

const PAYMENT_OPTIONS: Record<PaymentMethod, { title: string; description: string; icon: typeof Truck }> = {
  BANK_TRANSFER: {
    title: 'Bank transfer',
    description: "Pay each shop's amount into its bank account. Account details appear after you place the order.",
    icon: Landmark,
  },
  CHAPA: {
    title: 'Chapa (online)',
    description: 'Pay the whole order online in one step.',
    icon: CreditCard,
  },
};

const NEW_ADDRESS = 'new';

const checkoutFormSchema = z
  .object({
    addressChoice: z.string(),
    contactName: z.string(),
    addressName: z.string(),
    houseNumber: z.string(),
    phoneNumber: z.string(),
    saveAddress: z.boolean(),
    customerNote: z.string().max(500, 'Note must be at most 500 characters'),
    paymentMethod: z.enum(PAYMENT_METHODS),
  })
  .superRefine((values, ctx) => {
    if (values.addressChoice !== NEW_ADDRESS) return;
    const result = addressFieldsSchema.safeParse(values);
    if (result.success) return;
    for (const issue of result.error.issues) ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
  });
type CheckoutFormValues = z.input<typeof checkoutFormSchema>;

export function CheckoutPage() {
  const [preference, setPreference] = useState<FulfillmentPreference>('DELIVERY');
  // Every amount on this page is recomputed by the server from live prices and stock.
  const quoteQuery = useQuery({
    queryKey: ['checkout-quote', preference],
    queryFn: () => api.post<CheckoutQuote>('/checkout/quote', { fulfillmentPreference: preference }),
    staleTime: 0,
  });
  const addressesQuery = useAddresses();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <Link to="/cart" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-950">
        <ArrowLeft className="size-4" /> Back to cart
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Checkout</h1>

      {addressesQuery.isPending ? (
        <Skeleton className="mt-6 h-96" />
      ) : (
        <CheckoutForm
          addresses={addressesQuery.data ?? []}
          preference={preference}
          onPreferenceChange={setPreference}
          quoteQuery={quoteQuery}
        />
      )}
    </div>
  );
}

function CheckoutForm({
  addresses,
  preference,
  onPreferenceChange,
  quoteQuery,
}: {
  addresses: CustomerAddress[];
  preference: FulfillmentPreference;
  onPreferenceChange: (value: FulfillmentPreference) => void;
  quoteQuery: UseQueryResult<CheckoutQuote>;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  // Reused while retrying the same submission, so a lost response cannot create a second order.
  const [firstKey] = useState(() => crypto.randomUUID());
  const idempotencyKey = useRef(firstKey);
  const preferred = addresses.find((address) => address.isDefault) ?? addresses[0];

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      addressChoice: preferred?.id ?? NEW_ADDRESS,
      contactName: user?.fullName ?? '',
      addressName: '',
      houseNumber: '',
      phoneNumber: '',
      saveAddress: true,
      customerNote: '',
      paymentMethod: 'BANK_TRANSFER',
    },
  });
  const addressChoice = watch('addressChoice');
  const paymentMethod = watch('paymentMethod');
  const quote = quoteQuery.data;
  const methodAvailable = quote?.paymentMethods.includes(paymentMethod) ?? false;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const contact =
      values.addressChoice === NEW_ADDRESS
        ? {
            contactName: values.contactName,
            addressName: values.addressName,
            houseNumber: values.houseNumber,
            phoneNumber: values.phoneNumber,
            saveAddress: values.saveAddress,
          }
        : { addressId: values.addressChoice };
    try {
      const result = await api.post<CheckoutResult>(
        '/checkout',
        {
          fulfillmentPreference: preference,
          paymentMethod: values.paymentMethod,
          customerNote: blankToUndefined(values.customerNote),
          ...contact,
        },
        { headers: { [IDEMPOTENCY_HEADER]: idempotencyKey.current } },
      );
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
      navigate(`/account/orders/${result.order.id}`, { replace: true, state: { placed: true } });
    } catch (error) {
      // The server answered, so this attempt is settled; a changed form needs a new key.
      if (!(error instanceof ApiError) || error.code !== 'NETWORK_ERROR') {
        idempotencyKey.current = crypto.randomUUID();
      }
      if (error instanceof ApiError && error.code === 'BUSINESS_RULE') void quoteQuery.refetch();
      setFormError(applyServerErrors(error, setError, [...ADDRESS_FIELDS, 'customerNote', 'paymentMethod']));
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mt-6 grid gap-6 pb-48 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:pb-0 [&_input]:scroll-mb-48 [&_textarea]:scroll-mb-48"
    >
      <div className="space-y-6">
        <section aria-labelledby="order-structure-heading">
          <h2 id="order-structure-heading" className="mb-3 text-sm font-semibold text-ink-950">
            Your order
          </h2>
          <QuoteLines quoteQuery={quoteQuery} />
        </section>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-ink-950">How do you want to receive your order?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {FULFILLMENT_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.value}
                name="fulfillment"
                checked={preference === option.value}
                onChange={() => onPreferenceChange(option.value)}
                icon={<option.icon className="mt-0.5 size-5 shrink-0 text-accent-700" />}
                title={option.title}
                description={option.description}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-ink-950">Contact for the shops</legend>
          <p className="mb-3 text-sm text-ink-500">
            Every shop in this order receives this name, address and phone number
            {preference === 'PICKUP' ? ' so they can recognise you at pickup.' : ' for delivery.'}
          </p>
          <div className="space-y-3">
            {addresses.map((address) => (
              <ChoiceCard
                key={address.id}
                value={address.id}
                {...register('addressChoice')}
                checked={addressChoice === address.id}
                icon={<MapPin className="mt-0.5 size-5 shrink-0 text-accent-700" />}
                title={`${address.addressName}, house ${address.houseNumber}`}
                description={`${address.contactName} · ${address.phoneNumber}${address.isDefault ? ' · Default' : ''}`}
              />
            ))}
            {addresses.length > 0 ? (
              <ChoiceCard
                value={NEW_ADDRESS}
                {...register('addressChoice')}
                checked={addressChoice === NEW_ADDRESS}
                icon={<MapPin className="mt-0.5 size-5 shrink-0 text-ink-400" />}
                title="Use a different address"
              />
            ) : null}
            {addressChoice === NEW_ADDRESS ? (
              <Card className="space-y-4 p-5">
                <AddressFields register={register} errors={errors} />
                <Switch {...register('saveAddress')} label="Save this address for next time" />
              </Card>
            ) : null}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-ink-950">Payment method</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {PAYMENT_METHODS.map((method) => {
              const option = PAYMENT_OPTIONS[method];
              const available = quote ? quote.paymentMethods.includes(method) : method === 'BANK_TRANSFER';
              return (
                <ChoiceCard
                  key={method}
                  value={method}
                  {...register('paymentMethod')}
                  checked={paymentMethod === method}
                  disabled={!available}
                  icon={<option.icon className="mt-0.5 size-5 shrink-0 text-accent-700" />}
                  title={option.title}
                  description={available ? option.description : 'Not available yet.'}
                />
              );
            })}
          </div>
          {errors.paymentMethod ? <p className="mt-2 text-sm text-red-600">{errors.paymentMethod.message}</p> : null}
        </fieldset>

        <Field label="Note for the shops" error={errors.customerNote?.message} hint="Optional, up to 500 characters.">
          {(field) => <Textarea {...field} {...register('customerNote')} rows={2} invalid={!!errors.customerNote} />}
        </Field>
      </div>

      <Card className="fixed inset-x-0 bottom-0 z-30 max-h-[46vh] overflow-y-auto rounded-none border-x-0 border-b-0 p-4 pr-20 shadow-[0_-8px_24px_rgba(28,25,23,0.08)] lg:sticky lg:top-24 lg:max-h-none lg:overflow-visible lg:rounded-2xl lg:border lg:p-5 lg:pr-5 lg:shadow-card">
        <h2 className="text-base font-semibold text-ink-950">Order total</h2>
        {quote ? (
          <>
            {quote.shops.length > 0 ? (
              <ul className="mt-3 hidden space-y-1.5 border-b border-ink-100 pb-3 text-sm lg:block">
                {quote.shops.map((shop) => (
                  <li key={shop.shopId} className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-ink-700">{shop.shopName}</span>
                    <span className="shrink-0 font-medium text-ink-900">{formatMoney(shop.total)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <dl className="mt-3 space-y-2 text-sm">
              <div className="hidden justify-between lg:flex">
                <dt className="text-ink-600">Merchandise</dt>
                <dd className="font-medium">{formatMoney(quote.merchandiseSubtotal)}</dd>
              </div>
              <div className="hidden justify-between lg:flex">
                <dt className="text-ink-600">Delivery fees</dt>
                <dd className="font-medium">{formatMoney(quote.deliveryFeeTotal)}</dd>
              </div>
              <div className="flex justify-between text-base font-semibold text-ink-950 lg:border-t lg:border-ink-100 lg:pt-3">
                <dt>Total</dt>
                <dd>{formatMoney(quote.grandTotal)}</dd>
              </div>
            </dl>
            {!quote.canCheckout && quote.shops.length > 0 ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                Some items changed since you added them.{' '}
                <Link to="/cart" className="font-semibold underline underline-offset-4">
                  Update your cart
                </Link>{' '}
                to continue.
              </div>
            ) : null}
          </>
        ) : (
          <Skeleton className="mt-4 h-24" />
        )}
        <div className="mt-4">
          <FormError message={formError} />
        </div>
        <Button
          type="submit"
          size="lg"
          className="mt-4 w-full"
          loading={isSubmitting}
          disabled={!quote?.canCheckout || !methodAvailable || quoteQuery.isFetching}
        >
          Place order
        </Button>
        <div className="mt-4 hidden gap-2.5 rounded-xl bg-accent-50 p-3 text-sm text-accent-900 lg:flex">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Prices, stock and fees are checked again when you place the order. Each shop receives only its own part of the
            order, and your items are reserved while you pay.
          </p>
        </div>
      </Card>
    </form>
  );
}

type ChoiceCardProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'title'> & {
  icon: ReactNode;
  title: string;
  description?: string;
  ref?: Ref<HTMLInputElement>;
};

/** A radio input styled as a selectable card. */
function ChoiceCard({ icon, title, description, checked, disabled, className, ...input }: ChoiceCardProps) {
  return (
    <label
      className={cn(
        'flex gap-3 rounded-2xl border p-4 transition-colors',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        checked ? 'border-ink-950 ring-2 ring-accent-400/60' : 'border-ink-200 hover:border-ink-400',
        className,
      )}
    >
      <input type="radio" className="sr-only" checked={checked} disabled={disabled} {...input} />
      {icon}
      <span>
        <span className="block text-sm font-semibold text-ink-950">{title}</span>
        {description ? <span className="block text-sm text-ink-500">{description}</span> : null}
      </span>
    </label>
  );
}

function QuoteLines({ quoteQuery }: { quoteQuery: UseQueryResult<CheckoutQuote> }) {
  if (quoteQuery.isPending) return <Skeleton className="h-64" />;
  if (quoteQuery.isError) return <ErrorState error={quoteQuery.error} onRetry={() => void quoteQuery.refetch()} />;
  if (quoteQuery.data.shops.length === 0) {
    return <EmptyState title="Your cart is empty" action={<ButtonLink to="/">Explore shops</ButtonLink>} />;
  }
  return (
    <div className="space-y-4">
      {quoteQuery.data.shops.map((group) => (
        <Card key={group.shopId}>
          <div className="flex items-center gap-2 border-b border-ink-100 px-5 py-3 font-semibold text-ink-950">
            <Store className="size-4 text-accent-700" /> {group.shopName}
          </div>
          <ul className="divide-y divide-ink-100 px-5">
            {group.items.map((line) => (
              <li key={line.cartItemId} className="flex items-start gap-3 py-3 text-sm">
                <ImageWithFallback src={line.imageUrl} alt="" iconClassName="size-4" className="size-12 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-900">{line.name}</p>
                  <p className="text-ink-500">
                    {line.quantity} × {formatMoney(line.unitPrice)}
                  </p>
                  {line.issue ? (
                    <div className="mt-1">
                      <LineIssueBadge issue={line.issue} />
                    </div>
                  ) : null}
                </div>
                <p className={line.issue ? 'text-ink-400 line-through' : 'font-medium text-ink-900'}>
                  {formatMoney(line.lineTotal)}
                </p>
              </li>
            ))}
          </ul>
          <dl className="space-y-1 border-t border-ink-100 px-5 py-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-600">Subtotal</dt>
              <dd>{formatMoney(group.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-600">Delivery fee</dt>
              <dd>{formatMoney(group.deliveryFee)}</dd>
            </div>
            <div className="flex justify-between font-semibold text-ink-950">
              <dt>Shop total</dt>
              <dd>{formatMoney(group.total)}</dd>
            </div>
          </dl>
        </Card>
      ))}
    </div>
  );
}
