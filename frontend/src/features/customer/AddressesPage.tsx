import { zodResolver } from '@hookform/resolvers/zod';
import { MAX_SAVED_ADDRESSES, type CustomerAddress } from '@marketplace/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../../auth/AuthProvider';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { FormError, Switch } from '../../components/ui/Form';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { api, errorMessage } from '../../lib/api';
import { applyServerErrors } from '../../lib/forms';
import { ADDRESS_FIELDS, AddressFields, addressFieldsSchema } from './AddressFields';
import { customerKeys, useAddresses } from './queries';

const addressFormSchema = addressFieldsSchema.extend({ isDefault: z.boolean() });
type AddressFormValues = z.input<typeof addressFormSchema>;

export function AddressesPage() {
  const addressesQuery = useAddresses();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<CustomerAddress | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CustomerAddress | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: customerKeys.addresses });

  const makeDefault = async (address: CustomerAddress) => {
    setBusyId(address.id);
    try {
      await api.patch(`/customers/me/addresses/${address.id}`, { isDefault: true });
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await api.delete(`/customers/me/addresses/${deleting.id}`);
      await refresh();
      toast.success('Address deleted');
      setDeleting(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const addresses = addressesQuery.data ?? [];
  const full = addresses.length >= MAX_SAVED_ADDRESSES;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Saved addresses"
        description={`Pick one at checkout instead of typing it again. You can save up to ${MAX_SAVED_ADDRESSES}.`}
        actions={
          <Button onClick={() => setEditing('new')} disabled={full} icon={<Plus className="size-4" />}>
            Add address
          </Button>
        }
      />
      {addressesQuery.isPending ? (
        <LoadingState />
      ) : addressesQuery.isError ? (
        <ErrorState error={addressesQuery.error} onRetry={() => void addressesQuery.refetch()} />
      ) : addresses.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MapPin className="size-6" />}
            title="No saved addresses"
            description="Addresses you save here or at checkout appear in this list."
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {addresses.map((address) => (
            <li key={address.id}>
              <Card className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-0 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-950">
                    {address.addressName}, house {address.houseNumber}
                    {address.isDefault ? <Badge tone="accent">Default</Badge> : null}
                  </p>
                  <p className="mt-1 text-ink-600">
                    {address.contactName} · {address.phoneNumber}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!address.isDefault ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void makeDefault(address)}
                      loading={busyId === address.id && !deleting}
                      icon={<Star className="size-4" />}
                    >
                      Make default
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditing(address)}
                    icon={<Pencil className="size-4" />}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleting(address)}
                    icon={<Trash2 className="size-4" />}
                    aria-label={`Delete ${address.addressName}`}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add address' : 'Edit address'}
      >
        {editing !== null ? (
          <AddressForm
            key={editing === 'new' ? 'new' : editing.id}
            address={editing === 'new' ? null : editing}
            isFirst={addresses.length === 0}
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              await refresh();
              toast.success('Address saved');
              setEditing(null);
            }}
          />
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void remove()}
        title="Delete this address?"
        description={deleting ? `${deleting.addressName}, house ${deleting.houseNumber}` : ''}
        confirmLabel="Delete"
        tone="danger"
        loading={busyId !== null && deleting !== null}
      />
    </div>
  );
}

function AddressForm({
  address,
  isFirst,
  onCancel,
  onSaved,
}: {
  address: CustomerAddress | null;
  isFirst: boolean;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      contactName: address?.contactName ?? user?.fullName ?? '',
      addressName: address?.addressName ?? '',
      houseNumber: address?.houseNumber ?? '',
      phoneNumber: address?.phoneNumber ?? '',
      isDefault: address?.isDefault ?? isFirst,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (address) await api.patch(`/customers/me/addresses/${address.id}`, values);
      else await api.post('/customers/me/addresses', values);
      await onSaved();
    } catch (error) {
      setFormError(applyServerErrors(error, setError, [...ADDRESS_FIELDS, 'isDefault']));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={formError} />
      <AddressFields register={register} errors={errors} />
      <Switch
        {...register('isDefault')}
        label="Use as my default address"
        description="Checkout selects the default address first."
      />
      <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          Save address
        </Button>
      </div>
    </form>
  );
}
