import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@marketplace/contracts';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { Field, FormError, Input } from '../../components/ui/Form';
import { applyServerErrors } from '../../lib/forms';
import { AuthCard } from './AuthCard';
import { returnPathFor } from './LoginPage';

const formSchema = registerSchema
  .extend({ confirmPassword: z.string().min(1, 'Repeat your password') })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export function RegisterPage() {
  const { register: registerAccount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { fullName: '', username: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ confirmPassword: _confirm, ...values }) => {
    setFormError(null);
    try {
      const user = await registerAccount(values);
      const from = (location.state as { from?: unknown } | null)?.from;
      navigate(returnPathFor(user, from), { replace: true });
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['fullName', 'username', 'password']));
    }
  });

  return (
    <AuthCard
      title="Create your account"
      description="Save your cart across devices and check out from shops near you."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" state={location.state} className="font-medium text-ink-950 underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="Full name" error={errors.fullName?.message}>
          {(field) => <Input {...field} {...register('fullName')} autoComplete="name" invalid={!!errors.fullName} />}
        </Field>
        <Field
          label="Username"
          error={errors.username?.message}
          hint="3–30 characters: lowercase letters, digits and underscores."
        >
          {(field) => (
            <Input
              {...field}
              {...register('username')}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              invalid={!!errors.username}
            />
          )}
        </Field>
        <Field label="Password" error={errors.password?.message} hint="At least 8 characters.">
          {(field) => (
            <Input
              {...field}
              {...register('password')}
              type="password"
              autoComplete="new-password"
              invalid={!!errors.password}
            />
          )}
        </Field>
        <Field label="Confirm password" error={errors.confirmPassword?.message}>
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
          Create account
        </Button>
        <p className="text-center text-xs text-ink-500">
          Merchant accounts are created by the marketplace administrator.
        </p>
      </form>
    </AuthCard>
  );
}
