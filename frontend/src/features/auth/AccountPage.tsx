import { KeyRound, LayoutDashboard, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { ButtonLink } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';

const ROLE_LABEL = { SUPER_ADMIN: 'Super Admin', MERCHANT: 'Merchant', CUSTOMER: 'Customer' } as const;

export function AccountPage() {
  const { user } = useAuth();
  if (!user) return null;
  const dashboard = user.role === 'SUPER_ADMIN' ? '/admin' : user.role === 'MERCHANT' ? '/merchant' : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink-950">Your account</h1>
      <Card>
        <CardHeader title="Profile" description="Your name and username identify you across the marketplace." />
        <dl className="divide-y divide-ink-100 px-5">
          {[
            ['Full name', user.fullName],
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
          <ButtonLink to="/account/change-password" variant="secondary" icon={<KeyRound className="size-4" />}>
            Change password
          </ButtonLink>
          {dashboard ? (
            <ButtonLink to={dashboard} icon={<LayoutDashboard className="size-4" />}>
              Open dashboard
            </ButtonLink>
          ) : (
            <ButtonLink to="/cart" icon={<ShoppingBag className="size-4" />}>
              View cart
            </ButtonLink>
          )}
        </div>
      </Card>
    </div>
  );
}
