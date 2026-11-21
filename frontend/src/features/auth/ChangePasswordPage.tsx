import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema } from '@marketplace/contracts';
import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { homePathFor, useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { Field, FormError, Input } from '../../components/ui/Form';
import { useToast } from '../../components/ui/Toast';
import { applyServerErrors } from '../../lib/forms';
import { AuthCard } from './AuthCard';

const formSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(128),
    newPassword: z.string(),
    confirmPassword: z.string().min(1, 'Repeat your new password'),
  })
  .superRefine((value, ctx) => {
    const result = changePasswordSchema.safeParse({
      currentPassword: value.currentPassword,
      newPassword: value.newPassword,
    });
    if (!result.success) {
      for (const issue of result.error.issues) ctx.addIssue({ ...issue, code: 'custom' });
    }
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({ code: 'custom', message: 'Passwords do not match', path: ['confirmPassword'] });
    }
  });

export function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const forced = user?.mustChangePassword ?? false;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setFormError(null);
    try {
      const updated = await changePassword({ currentPassword, newPassword });
      toast.success('Password changed. Other devices have been signed out.');
      navigate(homePathFor(updated), { replace: true });
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['currentPassword', 'newPassword']));
    }
  });

  return (
    <AuthCard
      title={forced ? 'Set a new password' : 'Change password'}
      description={
        forced
          ? 'Your account was created with a temporary password. Choose your own to continue.'
          : 'Changing your password signs you out on every other device.'
      }
      footer={
        forced ? (
          <button
            type="button"
            className="font-medium text-ink-700 underline underline-offset-4"
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
          >
            Sign out instead
          </button>
        ) : null
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {forced ? (
          <div className="flex gap-3 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>The rest of your dashboard unlocks once your new password is saved.</p>
          </div>
        ) : null}
        <FormError message={formError} />
        <Field label={forced ? 'Temporary password' : 'Current password'} error={errors.currentPassword?.message}>
          {(field) => (
            <Input
              {...field}
              {...register('currentPassword')}
              type="password"
              autoComplete="current-password"
              invalid={!!errors.currentPassword}
            />
          )}
        </Field>
        <Field label="New password" error={errors.newPassword?.message} hint="At least 8 characters.">
          {(field) => (
            <Input
              {...field}
              {...register('newPassword')}
              type="password"
              autoComplete="new-password"
              invalid={!!errors.newPassword}
            />
          )}
        </Field>
        <Field label="Confirm new password" error={errors.confirmPassword?.message}>
          {(field) => (
            <Input
              {...field}
              {...register('confirmPassword')}
              type="password"
              autoComplete="new-password"
              invalid={!!errors.confirmPassword}
            />
          )}
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Save new password
        </Button>
      </form>
    </AuthCard>
  );
}
