import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema, type CustomerProfile, type UpdateProfileInput } from '@marketplace/contracts';
import { KeyRound, LayoutDashboard, MapPin, Pencil, ReceiptText, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../auth/AuthProvider';
import { authStore } from '../../auth/auth-store';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Field, FormError, Input } from '../../components/ui/Form';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/api';
import { applyServerErrors } from '../../lib/forms';

const ROLE_LABEL = { SUPER_ADMIN: 'Super Admin', MERCHANT: 'Merchant', CUSTOMER: 'Customer' } as const;

export function AccountPage() {
  const { user } = useAuth();
  const [editingName, setEditingName] = useState(false);
  if (!user) return null;
  const dashboard =
    user.role === 'SUPER_ADMIN' ? '/admin' : user.role === 'MERCHANT' ? '/merchant' : '/shopper';
  const isCustomer = user.role === 'CUSTOMER';

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink-950">Your account</h1>
      <Card>
        <CardHeader
          title="Profile"
          description="Your name and username identify you across the marketplace."
          action={
            isCustomer && !editingName ? (
              <Button variant="ghost" size="sm" onClick={() => setEditingName(true)} icon={<Pencil className="size-4" />}>
                Edit name
              </Button>
            ) : undefined
          }
        />
        {editingName ? <NameForm currentName={user.fullName} onDone={() => setEditingName(false)} /> : null}
        <dl className="divide-y divide-ink-100 px-5">
          {[
            ...(editingName ? [] : [['Full name', user.fullName]]),
            ['Username', `@${user.username}`],
            ['Account type', ROLE_LABEL[user.role]],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-3 text-sm">
              <dt className="text-ink-500">{label}</dt>
              <dd className="font-medium text-ink-900">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2 border-t border-ink-100 px-5 py-4">
          <ButtonLink to={dashboard} icon={<LayoutDashboard className="size-4" />}>
            Open dashboard
          </ButtonLink>
          {isCustomer ? (
            <>
              <ButtonLink to="/account/orders" variant="secondary" icon={<ReceiptText className="size-4" />}>
                Your orders
              </ButtonLink>
              <ButtonLink to="/account/addresses" variant="secondary" icon={<MapPin className="size-4" />}>
                Saved addresses
              </ButtonLink>
              <ButtonLink to="/cart" variant="secondary" icon={<ShoppingBag className="size-4" />}>
                View cart
              </ButtonLink>
            </>
          ) : null}
          <ButtonLink to="/account/change-password" variant="secondary" icon={<KeyRound className="size-4" />}>
            Change password
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}

function NameForm({ currentName, onDone }: { currentName: string; onDone: () => void }) {
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { fullName: currentName },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const profile = await api.patch<CustomerProfile>('/customers/me', values);
      authStore.updateUser({ fullName: profile.fullName });
      toast.success('Name updated');
      onDone();
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['fullName']));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3 border-b border-ink-100 px-5 py-4">
      <FormError message={formError} />
      <Field label="Full name" required error={errors.fullName?.message}>
        {(field) => (
          <Input {...field} {...register('fullName')} autoComplete="name" autoFocus invalid={!!errors.fullName} />
        )}
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={isSubmitting}>
          Save name
        </Button>
      </div>
    </form>
  );
}
