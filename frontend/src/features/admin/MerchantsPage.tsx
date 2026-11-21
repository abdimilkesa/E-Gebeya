import { zodResolver } from '@hookform/resolvers/zod';
import { createMerchantSchema, type TemporaryCredentials } from '@marketplace/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { Field, FormError, Input, Select } from '../../components/ui/Form';
import { Pagination } from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/SearchInput';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui/States';
import { Table, Td, Th } from '../../components/ui/Table';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { applyServerErrors, blankToUndefined } from '../../lib/forms';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { invalidateAdminData, useAdminMerchants } from './queries';
import { TemporaryPasswordDialog } from './TemporaryPasswordDialog';

export function MerchantsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED' | ''>('');
  const [page, setPage] = useState(1);
  const [credentials, setCredentials] = useState<TemporaryCredentials | null>(null);
  const q = useDebouncedValue(search.trim());
  const merchantsQuery = useAdminMerchants({ q: q || undefined, status: status || undefined, page, pageSize: 20 });
  const creating = params.get('new') === '1';
  const setCreating = (open: boolean) => setParams(open ? { new: '1' } : {}, { replace: true });

  return (
    <div>
      <PageHeader
        title="Merchants"
        description="Merchant accounts are created here; merchants cannot sign up themselves."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            New merchant
          </Button>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search by name or username"
            className="flex-1"
          />
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
              setPage(1);
            }}
            aria-label="Filter by status"
            className="sm:w-44"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </Select>
        </div>
        {merchantsQuery.isPending ? (
          <LoadingState />
        ) : merchantsQuery.isError ? (
          <ErrorState error={merchantsQuery.error} onRetry={() => void merchantsQuery.refetch()} />
        ) : merchantsQuery.data.items.length === 0 ? (
          <EmptyState
            icon={<UsersRound className="size-6" />}
            title={q || status ? 'No merchants match' : 'No merchants yet'}
            description={q || status ? 'Try a different search.' : 'Create a merchant account, then assign them a shop.'}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Merchant</Th>
                  <Th>Phone</Th>
                  <Th className="text-right">Shops</Th>
                  <Th>Last sign-in</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {merchantsQuery.data.items.map((merchant) => (
                  <tr
                    key={merchant.id}
                    className="cursor-pointer hover:bg-ink-50"
                    onClick={() => navigate(`/admin/merchants/${merchant.id}`)}
                  >
                    <Td>
                      <Link
                        to={`/admin/merchants/${merchant.id}`}
                        className="font-medium text-ink-950 hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {merchant.fullName}
                      </Link>
                      <p className="text-xs text-ink-500">
                        @{merchant.username}
                        {merchant.businessName ? ` · ${merchant.businessName}` : ''}
                      </p>
                    </Td>
                    <Td>{merchant.contactPhone ?? '—'}</Td>
                    <Td className="text-right tabular-nums">{merchant.shopCount}</Td>
                    <Td>
                      {merchant.lastLoginAt ? formatDate(merchant.lastLoginAt) : <Badge tone="accent">Never signed in</Badge>}
                    </Td>
                    <Td>
                      <StatusBadge status={merchant.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="px-4">
              <Pagination meta={merchantsQuery.data.meta} onPageChange={setPage} />
            </div>
          </>
        )}
      </Card>

      <CreateMerchantDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(created) => {
          setCreating(false);
          setCredentials(created);
        }}
      />
      <TemporaryPasswordDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
}

const createFormSchema = z.object({
  fullName: createMerchantSchema.shape.fullName,
  username: createMerchantSchema.shape.username,
  contactPhone: createMerchantSchema.shape.contactPhone,
  businessName: z.string().trim().max(160),
});

function CreateMerchantDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (credentials: TemporaryCredentials) => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(createFormSchema),
    defaultValues: { fullName: '', username: '', contactPhone: '', businessName: '' },
  });

  const close = () => {
    reset();
    setFormError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      // No password is sent: the server generates a strong temporary one and returns it once.
      const created = await api.post<TemporaryCredentials>('/admin/merchants', {
        fullName: values.fullName,
        username: values.username,
        contactPhone: values.contactPhone,
        businessName: blankToUndefined(values.businessName),
      });
      invalidateAdminData(queryClient);
      reset();
      onCreated(created);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['fullName', 'username', 'contactPhone', 'businessName']));
    }
  });

  return (
    <Dialog
      open={open}
      onClose={close}
      title="New merchant"
      description="A temporary password is generated and shown once after saving."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="create-merchant-form" loading={isSubmitting}>
            Create merchant
          </Button>
        </>
      }
    >
      <form id="create-merchant-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="Full name" required error={errors.fullName?.message}>
          {(field) => <Input {...field} {...register('fullName')} invalid={!!errors.fullName} />}
        </Field>
        <Field label="Username" required error={errors.username?.message} hint="Lowercase letters, digits and underscores.">
          {(field) => (
            <Input {...field} {...register('username')} autoCapitalize="none" spellCheck={false} invalid={!!errors.username} />
          )}
        </Field>
        <Field label="Contact phone" required error={errors.contactPhone?.message}>
          {(field) => <Input {...field} {...register('contactPhone')} type="tel" inputMode="tel" invalid={!!errors.contactPhone} />}
        </Field>
        <Field label="Business name" error={errors.businessName?.message} hint="Optional, e.g. the registered trade name.">
          {(field) => <Input {...field} {...register('businessName')} invalid={!!errors.businessName} />}
        </Field>
      </form>
    </Dialog>
  );
}
