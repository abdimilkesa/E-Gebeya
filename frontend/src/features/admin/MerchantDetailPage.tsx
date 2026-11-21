import { zodResolver } from '@hookform/resolvers/zod';
import { phoneSchema, type AdminMerchantDetail, type TemporaryCredentials } from '@marketplace/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, Plus, Store } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import { z } from 'zod';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { Field, FormError, Input } from '../../components/ui/Form';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { api, errorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { applyServerErrors } from '../../lib/forms';
import { invalidateAdminData, useAdminMerchant } from './queries';
import { TemporaryPasswordDialog } from './TemporaryPasswordDialog';

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
  contactPhone: phoneSchema,
  businessName: z.string().trim().max(160),
});

export function MerchantDetailPage() {
  const { merchantId } = useParams();
  const merchantQuery = useAdminMerchant(merchantId);

  if (merchantQuery.isPending) return <LoadingState />;
  if (merchantQuery.isError) return <ErrorState error={merchantQuery.error} onRetry={() => void merchantQuery.refetch()} />;
  return <MerchantDetail key={merchantQuery.data.id} merchant={merchantQuery.data} />;
}

function MerchantDetail({ merchant }: { merchant: AdminMerchantDetail }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<'suspend' | 'activate' | 'reset' | null>(null);
  const [credentials, setCredentials] = useState<TemporaryCredentials | null>(null);

  const statusMutation = useMutation({
    mutationFn: (status: 'ACTIVE' | 'SUSPENDED') => api.patch(`/admin/merchants/${merchant.id}/status`, { status }),
    onSuccess: (_data, status) => {
      toast.success(status === 'SUSPENDED' ? 'Merchant suspended and signed out everywhere' : 'Merchant reactivated');
      setConfirm(null);
      invalidateAdminData(queryClient);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const resetMutation = useMutation({
    mutationFn: () => api.post<TemporaryCredentials>(`/admin/merchants/${merchant.id}/reset-password`, {}),
    onSuccess: (created) => {
      setConfirm(null);
      setCredentials(created);
      invalidateAdminData(queryClient);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div>
      <Link to="/admin/merchants" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-950">
        <ArrowLeft className="size-4" /> All merchants
      </Link>
      <PageHeader
        title={merchant.fullName}
        description={`@${merchant.username}`}
        actions={
          <>
            <StatusBadge status={merchant.status} />
            {merchant.mustChangePassword ? <Badge tone="accent">Temporary password</Badge> : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ProfileCard merchant={merchant} />

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Shops"
              action={
                <ButtonLink to="/admin/shops/new" variant="secondary" size="sm" icon={<Plus className="size-4" />}>
                  New shop
                </ButtonLink>
              }
            />
            {merchant.shops.length === 0 ? (
              <EmptyState icon={<Store className="size-6" />} title="No shop assigned" description="Create a shop and choose this merchant." />
            ) : (
              <ul className="divide-y divide-ink-100">
                {merchant.shops.map((shop) => (
                  <li key={shop.id}>
                    <Link to={`/admin/shops/${shop.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-ink-50">
                      <span className="font-medium text-ink-900">{shop.name}</span>
                      <StatusBadge status={shop.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Access" />
            <div className="space-y-4 p-5 text-sm">
              <dl className="space-y-2">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Last sign-in</dt>
                  <dd className="text-ink-900">{merchant.lastLoginAt ? formatDateTime(merchant.lastLoginAt) : 'Never'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Created</dt>
                  <dd className="text-ink-900">{formatDateTime(merchant.createdAt)}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" icon={<KeyRound className="size-4" />} onClick={() => setConfirm('reset')}>
                  Reset password
                </Button>
                {merchant.status === 'ACTIVE' ? (
                  <Button variant="secondary" size="sm" onClick={() => setConfirm('suspend')}>
                    Suspend account
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setConfirm('activate')}>
                    Reactivate account
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'suspend'}
        onClose={() => setConfirm(null)}
        onConfirm={() => statusMutation.mutate('SUSPENDED')}
        title="Suspend this merchant?"
        description="They are signed out immediately, cannot sign in, and their shops disappear from the map until you reactivate them."
        confirmLabel="Suspend"
        tone="danger"
        loading={statusMutation.isPending}
      />
      <ConfirmDialog
        open={confirm === 'activate'}
        onClose={() => setConfirm(null)}
        onConfirm={() => statusMutation.mutate('ACTIVE')}
        title="Reactivate this merchant?"
        description="They can sign in again and their active shops return to the map."
        confirmLabel="Reactivate"
        loading={statusMutation.isPending}
      />
      <ConfirmDialog
        open={confirm === 'reset'}
        onClose={() => setConfirm(null)}
        onConfirm={() => resetMutation.mutate()}
        title="Reset password?"
        description="A new temporary password is generated, and every current session of this merchant is signed out."
        confirmLabel="Reset password"
        loading={resetMutation.isPending}
      />
      <TemporaryPasswordDialog credentials={credentials} onClose={() => setCredentials(null)} title="New temporary password" />
    </div>
  );
}

function ProfileCard({ merchant }: { merchant: AdminMerchantDetail }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: merchant.fullName,
      contactPhone: merchant.contactPhone ?? '',
      businessName: merchant.businessName ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const businessName = values.businessName || null;
    const changes = {
      ...(values.fullName !== merchant.fullName ? { fullName: values.fullName } : {}),
      ...(values.contactPhone !== merchant.contactPhone ? { contactPhone: values.contactPhone } : {}),
      ...(businessName !== merchant.businessName ? { businessName } : {}),
    };
    if (Object.keys(changes).length === 0) return;
    try {
      const updated = await api.patch<AdminMerchantDetail>(`/admin/merchants/${merchant.id}`, changes);
      reset({
        fullName: updated.fullName,
        contactPhone: updated.contactPhone ?? '',
        businessName: updated.businessName ?? '',
      });
      toast.success('Merchant details saved');
      invalidateAdminData(queryClient);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['fullName', 'contactPhone', 'businessName']));
    }
  });

  return (
    <Card>
      <CardHeader title="Details" description="The username cannot be changed." />
      <form onSubmit={onSubmit} className="space-y-4 p-5" noValidate>
        <FormError message={formError} />
        <Field label="Full name" required error={errors.fullName?.message}>
          {(field) => <Input {...field} {...register('fullName')} invalid={!!errors.fullName} />}
        </Field>
        <Field label="Contact phone" required error={errors.contactPhone?.message}>
          {(field) => <Input {...field} {...register('contactPhone')} type="tel" invalid={!!errors.contactPhone} />}
        </Field>
        <Field label="Business name" error={errors.businessName?.message}>
          {(field) => <Input {...field} {...register('businessName')} invalid={!!errors.businessName} />}
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Save details
          </Button>
        </div>
      </form>
    </Card>
  );
}
