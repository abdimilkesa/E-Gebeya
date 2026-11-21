import type { AdminCustomer } from '@marketplace/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { Select } from '../../components/ui/Form';
import { Pagination } from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/SearchInput';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui/States';
import { Table, Td, Th } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';
import { api, errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { invalidateAdminData, useAdminCustomers } from './queries';

export function CustomersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED' | ''>('');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminCustomer | null>(null);
  const q = useDebouncedValue(search.trim());
  const customersQuery = useAdminCustomers({ q: q || undefined, status: status || undefined, page, pageSize: 20 });

  const mutation = useMutation({
    mutationFn: (customer: AdminCustomer) =>
      api.patch(`/admin/customers/${customer.id}/status`, {
        status: customer.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
      }),
    onSuccess: (_data, customer) => {
      toast.success(customer.status === 'ACTIVE' ? `${customer.fullName} suspended` : `${customer.fullName} reactivated`);
      setTarget(null);
      invalidateAdminData(queryClient);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const suspending = target?.status === 'ACTIVE';

  return (
    <div>
      <PageHeader title="Customers" description="People who registered to shop." />
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
        {customersQuery.isPending ? (
          <LoadingState />
        ) : customersQuery.isError ? (
          <ErrorState error={customersQuery.error} onRetry={() => void customersQuery.refetch()} />
        ) : customersQuery.data.items.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title={q || status ? 'No customers match' : 'No customers yet'}
            description={q || status ? 'Try a different search.' : 'Customers appear here after they register.'}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Customer</Th>
                  <Th>Joined</Th>
                  <Th>Last sign-in</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {customersQuery.data.items.map((customer) => (
                  <tr key={customer.id}>
                    <Td>
                      <p className="font-medium text-ink-950">{customer.fullName}</p>
                      <p className="text-xs text-ink-500">@{customer.username}</p>
                    </Td>
                    <Td>{formatDate(customer.createdAt)}</Td>
                    <Td>{customer.lastLoginAt ? formatDate(customer.lastLoginAt) : '—'}</Td>
                    <Td>
                      <StatusBadge status={customer.status} />
                    </Td>
                    <Td className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setTarget(customer)}>
                        {customer.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="px-4">
              <Pagination meta={customersQuery.data.meta} onPageChange={setPage} />
            </div>
          </>
        )}
      </Card>
      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        onConfirm={() => target && mutation.mutate(target)}
        title={suspending ? 'Suspend this customer?' : 'Reactivate this customer?'}
        description={
          suspending
            ? `${target?.fullName ?? 'The customer'} is signed out immediately and cannot sign in until reactivated.`
            : `${target?.fullName ?? 'The customer'} can sign in and shop again.`
        }
        confirmLabel={suspending ? 'Suspend' : 'Reactivate'}
        tone={suspending ? 'danger' : 'primary'}
        loading={mutation.isPending}
      />
    </div>
  );
}
