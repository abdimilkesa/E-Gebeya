import { ArrowLeft, CheckCircle2, ExternalLink, MapPin, Phone, ShoppingBag, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, ButtonLink } from '../../components/ui/Button';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format';
import { useCart } from '../cart/CartProvider';
import { googleMapsUrl, usePublicProduct } from './queries';

export function ProductPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const productQuery = usePublicProduct(productId);
  const { mode, addItem, pending } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);

  if (productQuery.isPending) {
    return (
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-2">
        <Skeleton className="aspect-square w-full" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (productQuery.isError) {
    const missing = productQuery.error instanceof ApiError && productQuery.error.status === 404;
    return missing ? (
      <EmptyState
        className="py-24"
        title="This product is not available"
        description="It may have been removed by the shop or the link is wrong."
        action={<ButtonLink to="/search">Browse products</ButtonLink>}
      />
    ) : (
      <ErrorState error={productQuery.error} onRetry={() => void productQuery.refetch()} className="py-24" />
    );
  }

  const product = productQuery.data;
  const images = product.images.length > 0 ? product.images : [{ url: null }];
  const current = images[Math.min(imageIndex, images.length - 1)]!;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(`/shops/${product.shop.slug}`))}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-950"
      >
        <ArrowLeft className="size-4" /> Back
      </button>

      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl border border-ink-100 bg-ink-50">
            <ImageWithFallback src={current.url} alt={product.name} className="size-full" iconClassName="size-12" eager />
          </div>
          {images.length > 1 ? (
            <div className="mt-3 flex gap-2" role="list" aria-label="Product photos">
              {images.map((image, index) => (
                <button
                  key={image.url ?? index}
                  type="button"
                  role="listitem"
                  onClick={() => setImageIndex(index)}
                  aria-label={`Show photo ${index + 1}`}
                  aria-current={index === imageIndex}
                  className={cn(
                    'size-16 overflow-hidden rounded-xl border-2 bg-ink-50 sm:size-20',
                    index === imageIndex ? 'border-ink-950' : 'border-transparent opacity-75 hover:opacity-100',
                  )}
                >
                  <ImageWithFallback src={image.url} alt="" className="size-full" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-accent-700">{product.category.name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl">{product.name}</h1>
          <p className="mt-3 text-2xl font-semibold text-ink-950">{formatMoney(product.price)}</p>
          <p
            className={cn(
              'mt-2 inline-flex items-center gap-1.5 text-sm font-medium',
              product.canPurchase ? 'text-emerald-700' : 'text-ink-500',
            )}
          >
            {product.canPurchase ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
            {product.canPurchase ? 'Available' : 'Currently unavailable'}
          </p>

          <div className="mt-6 rounded-2xl border border-ink-100 p-4">
            {mode === 'unavailable' ? (
              <p className="text-sm text-ink-600">Shopping is available with a customer account.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <QuantityStepper value={quantity} onChange={setQuantity} disabled={!product.canPurchase} />
                <Button
                  size="lg"
                  className="flex-1"
                  disabled={!product.canPurchase}
                  loading={pending}
                  icon={<ShoppingBag className="size-5" />}
                  onClick={async () => {
                    if (await addItem(product.id, quantity)) setQuantity(1);
                  }}
                >
                  {product.canPurchase ? 'Add to cart' : 'Unavailable'}
                </Button>
              </div>
            )}
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-semibold text-ink-950">Description</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-700">{product.description}</p>
          </div>

          <div className="mt-6 rounded-2xl bg-ink-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Sold by</p>
            <Link to={`/shops/${product.shop.slug}`} className="mt-1 block text-base font-semibold text-ink-950 hover:underline">
              {product.shop.name}
            </Link>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-600">
              <MapPin className="mt-0.5 size-4 shrink-0" /> {product.shop.addressText}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`tel:${product.shop.phone}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-ink-800 shadow-sm hover:bg-ink-100"
              >
                <Phone className="size-4" /> Call shop
              </a>
              <a
                href={googleMapsUrl(product.shop.latitude, product.shop.longitude)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-ink-800 shadow-sm hover:bg-ink-100"
              >
                <ExternalLink className="size-4" /> Directions
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
