import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type AuthUser } from '@marketplace/contracts';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { homePathFor, useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { Field, FormError, Input } from '../../components/ui/Form';
import { applyServerErrors } from '../../lib/forms';
import { AuthCard } from './AuthCard';

/** Only follow "return to" paths that the signed-in role is allowed to open. */
export function returnPathFor(user: AuthUser, from: unknown): string {
  const home = homePathFor(user);
  if (user.mustChangePassword || typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) {
    return home;
  }
  if (from.startsWith('/admin')) return user.role === 'SUPER_ADMIN' ? from : home;
  if (from.startsWith('/merchant')) return user.role === 'MERCHANT' ? from : home;
  if (from.startsWith('/shopper')) return user.role === 'CUSTOMER' ? from : home;
  const customerOnly = ['/checkout', '/account/orders', '/account/addresses'];
  if (customerOnly.some((path) => from.startsWith(path))) return user.role === 'CUSTOMER' ? from : home;
  if (from === '/login' || from === '/register') return home;
  return from;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { username: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await login(values);
      const from = (location.state as { from?: unknown } | null)?.from;
      navigate(returnPathFor(user, from), { replace: true });
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['username', 'password']));
    }
  });

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to shop, manage your store or run the marketplace."
      footer={
        <>
          New here?{' '}
          <Link to="/register" state={location.state} className="font-medium text-ink-950 underline underline-offset-4">
            Create a customer account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="Username" error={errors.username?.message}>
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
        <Field label="Password" error={errors.password?.message}>
          {(field) => (
            <Input
              {...field}
              {...register('password')}
              type="password"
              autoComplete="current-password"
              invalid={!!errors.password}
            />
          )}
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}
