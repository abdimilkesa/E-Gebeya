import { zodResolver } from '@hookform/resolvers/zod';
import {
  createProductSchema,
  MAX_PRODUCT_IMAGES,
  type CreateProductInput,
  type MerchantProduct,
  type UpdateProductInput,
} from '@marketplace/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, ArrowLeft, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { StatusBadge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { Field, FormError, Input, Select, Switch, Textarea } from '../../components/ui/Form';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { api, errorMessage } from '../../lib/api';
import { applyServerErrors } from '../../lib/forms';
import { useCategories } from '../discovery/queries';
import { ProductImagesField } from './ProductImagesField';
import { invalidateMerchantData, useMerchantProduct, useMerchantShops } from './queries';

const fields = createProductSchema.shape;

const productFormSchema = z.object({
  shopId: z.string(),
  categoryId: z.uuid('Choose a category'),
  name: fields.name,
  description: fields.description,
  price: fields.price,
  // An empty field would coerce to 0 and silently list the product as out of stock.
  stockQuantity: z
    .string()
    .trim()
    .min(1, 'Enter how many units you have')
    .regex(/^\d+$/, 'Stock must be a whole number')
    .transform(Number)
    .pipe(z.number().max(1_000_000, 'Stock cannot exceed 1,000,000')),
  isAvailable: z.boolean(),
  images: z.array(z.object({ publicId: z.string(), url: z.string() })).max(MAX_PRODUCT_IMAGES),
});
type ProductFormInput = z.input<typeof productFormSchema>;
type ProductFormOutput = z.output<typeof productFormSchema>;

const FIELD_NAMES = ['shopId', 'categoryId', 'name', 'description', 'price', 'stockQuantity', 'isAvailable', 'images'] as const;

function changesFrom(product: MerchantProduct, values: ProductFormOutput): UpdateProductInput {
  const changes: Record<string, unknown> = {};
  if (values.categoryId !== product.category.id) changes.categoryId = values.categoryId;
  if (values.name !== product.name) changes.name = values.name;
  if (values.description !== product.description) changes.description = values.description;
  if (Number(values.price) !== Number(product.price)) changes.price = values.price;
  if (values.stockQuantity !== product.stockQuantity) changes.stockQuantity = values.stockQuantity;
  if (values.isAvailable !== product.isAvailable) changes.isAvailable = values.isAvailable;
  const before = product.images.map((image) => image.publicId).join('|');
  const after = values.images.map((image) => image.publicId).join('|');
  if (before !== after) changes.images = values.images.map((image) => ({ publicId: image.publicId }));
  return changes as UpdateProductInput;
}

export function ProductFormPage() {
  const { productId } = useParams();
  const productQuery = useMerchantProduct(productId);
  const shopsQuery = useMerchantShops();
  const categoriesQuery = useCategories();

  if ((productId && productQuery.isPending) || shopsQuery.isPending || categoriesQuery.isPending) return <LoadingState />;
  if (productId && productQuery.isError) return <ErrorState error={productQuery.error} onRetry={() => void productQuery.refetch()} />;
  if (shopsQuery.isError) return <ErrorState error={shopsQuery.error} onRetry={() => void shopsQuery.refetch()} />;
  if (categoriesQuery.isError) return <ErrorState error={categoriesQuery.error} onRetry={() => void categoriesQuery.refetch()} />;
  if (shopsQuery.data.length === 0) {
    return (
      <EmptyState
        className="py-24"
        title="You do not have a shop yet"
        description="Ask the marketplace administrator to register your shop. You can add products right after."
      />
    );
  }
  return (
    <ProductForm
      key={productId ?? 'new'}
      product={productQuery.data}
      shops={shopsQuery.data.map((shop) => ({ id: shop.id, name: shop.name }))}
      categories={categoriesQuery.data}
    />
  );
}

function ProductForm({
  product,
  shops,
  categories,
}: {
  product?: MerchantProduct;
  shops: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const singleShop = shops.length === 1;
  const categoryOptions =
    product && !categories.some((category) => category.id === product.category.id)
      ? [{ id: product.category.id, name: `${product.category.name} (hidden by admin)` }, ...categories]
      : categories;

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormInput, unknown, ProductFormOutput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      shopId: product?.shopId ?? (singleShop ? shops[0]!.id : ''),
      categoryId: product?.category.id ?? '',
      name: product?.name ?? '',
      description: product?.description ?? '',
      price: product?.price ?? '',
      stockQuantity: product ? String(product.stockQuantity) : '',
      isAvailable: product?.isAvailable ?? true,
      images: product?.images.map((image) => ({ publicId: image.publicId, url: image.url })) ?? [],
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () =>
      product!.status === 'ACTIVE'
        ? api.delete<MerchantProduct>(`/merchant/products/${product!.id}`)
        : api.post<MerchantProduct>(`/merchant/products/${product!.id}/restore`),
    onSuccess: (updated) => {
      setConfirmArchive(false);
      toast.success(updated.status === 'ARCHIVED' ? 'Product archived and hidden from customers' : 'Product restored');
      invalidateMerchantData(queryClient);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!product && !values.shopId) {
      setError('shopId', { message: 'Choose which shop sells this product' });
      return;
    }
    try {
      if (product) {
        const changes = changesFrom(product, values);
        if (Object.keys(changes).length === 0) {
          toast.info('Nothing changed.');
          return;
        }
        await api.patch<MerchantProduct>(`/merchant/products/${product.id}`, changes);
        toast.success('Product saved');
      } else {
        const payload: CreateProductInput = {
          ...(singleShop ? {} : { shopId: values.shopId }),
          categoryId: values.categoryId,
          name: values.name,
          description: values.description,
          price: values.price,
          stockQuantity: values.stockQuantity,
          isAvailable: values.isAvailable,
          images: values.images.map((image) => ({ publicId: image.publicId })),
        };
        await api.post<MerchantProduct>('/merchant/products', payload);
        toast.success('Product added');
      }
      invalidateMerchantData(queryClient);
      navigate('/merchant/products');
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELD_NAMES));
    }
  });

  return (
    <div>
      <Link to="/merchant/products" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-950">
        <ArrowLeft className="size-4" /> All products
      </Link>
      <PageHeader
        title={product ? product.name : 'New product'}
        description={product ? `Sold by ${product.shopName}` : 'Customers see the price, photos and availability you set here.'}
        actions={
          product ? (
            <>
              <StatusBadge status={product.status} />
              {product.status === 'ACTIVE' ? (
                <ButtonLink
                  to={`/products/${product.id}`}
                  variant="secondary"
                  size="sm"
                  target="_blank"
                  icon={<ExternalLink className="size-4" />}
                >
                  View as customer
                </ButtonLink>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                icon={product.status === 'ACTIVE' ? <Archive className="size-4" /> : <ArchiveRestore className="size-4" />}
                onClick={() => (product.status === 'ACTIVE' ? setConfirmArchive(true) : archiveMutation.mutate())}
                loading={archiveMutation.isPending}
              >
                {product.status === 'ACTIVE' ? 'Archive' : 'Restore'}
              </Button>
            </>
          ) : null
        }
      />

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <FormError message={formError} />
        <Card>
          <CardHeader title="Product details" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Name" required error={errors.name?.message} className="sm:col-span-2">
              {(field) => <Input {...field} {...register('name')} invalid={!!errors.name} />}
            </Field>
            {!product && !singleShop ? (
              <Field label="Shop" required error={errors.shopId?.message}>
                {(field) => (
                  <Select {...field} {...register('shopId')} invalid={!!errors.shopId}>
                    <option value="">Choose a shop…</option>
                    {shops.map((shop) => (
                      <option key={shop.id} value={shop.id}>
                        {shop.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : null}
            <Field label="Category" required error={errors.categoryId?.message}>
              {(field) => (
                <Select {...field} {...register('categoryId')} invalid={!!errors.categoryId}>
                  <option value="">Choose a category…</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Description" required error={errors.description?.message} className="sm:col-span-2">
              {(field) => <Textarea {...field} {...register('description')} rows={5} invalid={!!errors.description} />}
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Price and stock" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Price (ETB)" required error={errors.price?.message} hint="Up to two decimals, e.g. 450 or 450.50">
              {(field) => <Input {...field} {...register('price')} inputMode="decimal" invalid={!!errors.price} />}
            </Field>
            <Field label="Units in stock" required error={errors.stockQuantity?.message}>
              {(field) => (
                <Input {...field} {...register('stockQuantity')} type="number" min={0} step={1} inputMode="numeric" invalid={!!errors.stockQuantity} />
              )}
            </Field>
            <div className="sm:col-span-2">
              <Controller
                control={control}
                name="isAvailable"
                render={({ field }) => (
                  <Switch
                    label="Available for purchase"
                    description="Turn off to pause sales without deleting the product, for example while restocking."
                    checked={field.value}
                    onChange={(event) => field.onChange(event.target.checked)}
                  />
                )}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Photos" />
          <div className="p-5">
            <Controller
              control={control}
              name="images"
              render={({ field }) => (
                <ProductImagesField value={field.value} onChange={field.onChange} error={errors.images?.message} />
              )}
            />
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <ButtonLink to="/merchant/products" variant="secondary">
            Cancel
          </ButtonLink>
          <Button type="submit" loading={isSubmitting}>
            {product ? 'Save changes' : 'Add product'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={() => archiveMutation.mutate()}
        title="Archive this product?"
        description="It disappears from your storefront and from customers' carts. You can restore it at any time."
        confirmLabel="Archive"
        tone="danger"
        loading={archiveMutation.isPending}
      />
    </div>
  );
}
