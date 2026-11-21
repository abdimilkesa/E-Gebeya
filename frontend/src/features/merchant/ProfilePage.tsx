import { zodResolver } from '@hookform/resolvers/zod';
import { fullNameSchema, phoneSchema, type MerchantProfile } from '@marketplace/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Field, FormError, Input } from '../../components/ui/Form';
import { ErrorState, LoadingState, PageHeader } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/api';
import { applyServerErrors } from '../../lib/forms';
import { merchantKeys, useMerchantProfile } from './queries';

const profileSchema = z.object({ fullName: fullNameSchema, contactPhone: phoneSchema });

export function ProfilePage() {
  const profileQuery = useMerchantProfile();
  return (
    <div>
      <PageHeader title="Profile" description="Your contact details for the marketplace team." />
      {profileQuery.isPending ? (
        <LoadingState />
      ) : profileQuery.isError ? (
        <ErrorState error={profileQuery.error} onRetry={() => void profileQuery.refetch()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <ProfileForm key={profileQuery.data.id} profile={profileQuery.data} />
          <Card>
            <CardHeader title="Sign-in" />
            <div className="space-y-4 p-5 text-sm">
              <dl className="space-y-2">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Username</dt>
                  <dd className="font-medium text-ink-900">@{profileQuery.data.username}</dd>
                </div>
                {profileQuery.data.businessName ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Business</dt>
                    <dd className="font-medium text-ink-900">{profileQuery.data.businessName}</dd>
                  </div>
                ) : null}
              </dl>
              <ButtonLink to="/account/change-password" variant="secondary" size="sm" icon={<KeyRound className="size-4" />}>
                Change password
              </ButtonLink>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function ProfileForm({ profile }: { profile: MerchantProfile }) {
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
    defaultValues: { fullName: profile.fullName, contactPhone: profile.contactPhone ?? '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const changes = {
      ...(values.fullName !== profile.fullName ? { fullName: values.fullName } : {}),
      ...(values.contactPhone !== profile.contactPhone ? { contactPhone: values.contactPhone } : {}),
    };
    if (Object.keys(changes).length === 0) return;
    try {
      const updated = await api.patch<MerchantProfile>('/merchant/profile', changes);
      queryClient.setQueryData(merchantKeys.profile, updated);
      reset({ fullName: updated.fullName, contactPhone: updated.contactPhone ?? '' });
      toast.success('Profile saved');
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['fullName', 'contactPhone']));
    }
  });

  return (
    <Card>
      <CardHeader title="Contact details" />
      <form onSubmit={onSubmit} className="space-y-4 p-5" noValidate>
        <FormError message={formError} />
        <Field label="Full name" required error={errors.fullName?.message}>
          {(field) => <Input {...field} {...register('fullName')} autoComplete="name" invalid={!!errors.fullName} />}
        </Field>
        <Field label="Contact phone" required error={errors.contactPhone?.message}>
          {(field) => <Input {...field} {...register('contactPhone')} type="tel" autoComplete="tel" invalid={!!errors.contactPhone} />}
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  );
}
