import { zodResolver } from '@hookform/resolvers/zod';
import type { AdminCategory } from '@marketplace/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderTree, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { Field, FormError, Input, Textarea } from '../../components/ui/Form';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui/States';
import { Table, Td, Th } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';
import { api, errorMessage } from '../../lib/api';
import { applyServerErrors } from '../../lib/forms';
import { invalidateAdminData, useAdminCategories } from './queries';

const categoryFormSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  description: z.string().trim().max(500),
});

export function CategoriesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const categoriesQuery = useAdminCategories();
  const [editing, setEditing] = useState<AdminCategory | 'new' | null>(null);

  const toggle = useMutation({
    mutationFn: (category: AdminCategory) =>
      api.patch<AdminCategory>(`/admin/categories/${category.id}`, { isActive: !category.isActive }),
    onSuccess: (updated) => {
      toast.success(updated.isActive ? `${updated.name} is visible again` : `${updated.name} hidden from shoppers`);
      invalidateAdminData(queryClient);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Merchants file each product under one category. Hidden categories disappear from filters and their products from the catalog."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            New category
          </Button>
        }
      />
      <Card>
        {categoriesQuery.isPending ? (
          <LoadingState />
        ) : categoriesQuery.isError ? (
          <ErrorState error={categoriesQuery.error} onRetry={() => void categoriesQuery.refetch()} />
        ) : categoriesQuery.data.length === 0 ? (
          <EmptyState icon={<FolderTree className="size-6" />} title="No categories yet" description="Run the seed or create the first category." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Slug</Th>
                <Th className="text-right">Products</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {categoriesQuery.data.map((category) => (
                <tr key={category.id}>
                  <Td>
                    <p className="font-medium text-ink-950">{category.name}</p>
                    {category.description ? <p className="text-xs text-ink-500">{category.description}</p> : null}
                  </Td>
                  <Td className="font-mono text-xs">{category.slug}</Td>
                  <Td className="text-right tabular-nums">{category.productCount}</Td>
                  <Td>{category.isActive ? <Badge tone="success">Visible</Badge> : <Badge>Hidden</Badge>}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(category)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggle.mutate(category)}
                        disabled={toggle.isPending && toggle.variables?.id === category.id}
                      >
                        {category.isActive ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {editing ? (
        <CategoryDialog
          key={editing === 'new' ? 'new' : editing.id}
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function CategoryDialog({ category, onClose }: { category: AdminCategory | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: category?.name ?? '', description: category?.description ?? '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (category) {
        const description = values.description || null;
        const changes = {
          ...(values.name !== category.name ? { name: values.name } : {}),
          ...(description !== category.description ? { description } : {}),
        };
        if (Object.keys(changes).length > 0) await api.patch(`/admin/categories/${category.id}`, changes);
        toast.success('Category saved');
      } else {
        await api.post('/admin/categories', {
          name: values.name,
          ...(values.description ? { description: values.description } : {}),
        });
        toast.success('Category created');
      }
      invalidateAdminData(queryClient);
      onClose();
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['name', 'description']));
    }
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={category ? 'Edit category' : 'New category'}
      description={category ? 'Renaming keeps the same link (slug), so existing filters keep working.' : undefined}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" loading={isSubmitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="Name" required error={errors.name?.message}>
          {(field) => <Input {...field} {...register('name')} invalid={!!errors.name} />}
        </Field>
        <Field label="Description" error={errors.description?.message}>
          {(field) => <Textarea {...field} {...register('description')} rows={3} invalid={!!errors.description} />}
        </Field>
      </form>
    </Dialog>
  );
}
