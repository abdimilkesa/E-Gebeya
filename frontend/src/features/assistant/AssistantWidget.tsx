import { DEFAULT_MAP_CENTER, type AssistantChatResponse, type AssistantProductCard, type AssistantShopCard } from '@marketplace/contracts';
import { MapPin, Send, Sparkles, Store, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { ApiError, api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format';

const SUGGESTIONS = [
  'Is berbere a fair price?',
  'Compare coffee you can buy',
  'Find shoes below 20,000 ETB',
];

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  products: AssistantProductCard[];
  shops: AssistantShopCard[];
}

type LocationChoice =
  | { kind: 'unknown' }
  | { kind: 'denied' }
  | { kind: 'device'; latitude: number; longitude: number }
  | { kind: 'jimma' };

const jimma = { kind: 'jimma' } as const;

function locationPayload(choice: LocationChoice) {
  if (choice.kind === 'device') return { latitude: choice.latitude, longitude: choice.longitude };
  if (choice.kind === 'jimma') return { latitude: DEFAULT_MAP_CENTER.lat, longitude: DEFAULT_MAP_CENTER.lng };
  return null;
}

export function AssistantWidget({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = useState(embedded);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [location, setLocation] = useState<LocationChoice>({ kind: 'unknown' });

  const ask = async (text: string) => {
    const message = text.trim();
    if (!message || pending) return;
    setDraft('');
    setError(null);
    const history = messages.slice(-10).map((entry) => ({ role: entry.role, text: entry.text }));
    setMessages((current) => [...current, { role: 'user', text: message, products: [], shops: [] }]);
    setPending(true);
    try {
      const result = await api.post<AssistantChatResponse>('/ai/chat', {
        message,
        history,
        location: locationPayload(location),
      });
      setMessages((current) => [
        ...current,
        { role: 'assistant', text: result.reply, products: result.products, shops: result.shops },
      ]);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The market analyst is not available right now.');
    } finally {
      setPending(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocation({ kind: 'denied' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setLocation({
          kind: 'device',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => setLocation({ kind: 'denied' }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  };

  return (
    <>
      {open ? (
        <section
          aria-label="Market analyst"
          className={
            embedded
              ? 'flex h-[min(40rem,calc(100dvh-12rem))] flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white'
              : 'fixed inset-x-3 bottom-20 z-40 flex max-h-[min(36rem,72vh)] flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-pop sm:inset-x-auto sm:right-5 sm:w-[24rem]'
          }
        >
          <header className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent-700" />
              <h2 className="text-sm font-semibold text-ink-950">Market analyst</h2>
            </div>
            {embedded ? null : (
              <button
                type="button"
                className="rounded-lg p-1 text-ink-500 hover:bg-ink-100 hover:text-ink-950"
                aria-label="Close market analyst"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </button>
            )}
          </header>

          <div className="border-b border-ink-100 px-4 py-3 text-sm">
            <p className="text-ink-600">
              {location.kind === 'device'
                ? 'Using your location for nearby shops. The exact point stays on this device and the server.'
                : location.kind === 'jimma'
                  ? 'Searching around Jimma center.'
                  : 'Nearby answers need a location. You can share yours or search around Jimma.'}
            </p>
            {location.kind === 'denied' ? (
              <p className="mt-1 text-amber-800">
                Location permission was denied. Nearby sorting needs access, or choose Jimma center.
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" icon={<MapPin className="size-3.5" />} onClick={useMyLocation}>
                Use my location
              </Button>
              <Button type="button" size="sm" variant={location.kind === 'jimma' ? 'primary' : 'secondary'} onClick={() => setLocation(jimma)}>
                Around Jimma
              </Button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div>
                <p className="text-sm text-ink-600">
                  Ask about a price, a comparison, or a budget. Answers use only the live catalog.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="rounded-xl border border-ink-200 px-3 py-2 text-left text-sm text-ink-800 hover:border-ink-400"
                      onClick={() => void ask(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <article key={`${message.role}-${index}`} className={message.role === 'user' ? 'text-right' : ''}>
                  <p
                    className={cn(
                      'inline-block max-w-[90%] rounded-2xl px-3 py-2 text-left text-sm',
                      message.role === 'user' ? 'bg-ink-950 text-white' : 'bg-ink-50 text-ink-800',
                    )}
                  >
                    {message.text}
                  </p>
                  {message.products.length > 0 ? (
                    <ul className="mt-2 space-y-2 text-left">
                      {message.products.map((product) => (
                        <ProductCard key={product.productId} product={product} />
                      ))}
                    </ul>
                  ) : null}
                  {message.shops.length > 0 ? (
                    <ul className="mt-2 space-y-2 text-left">
                      {message.shops.map((shop) => (
                        <ShopCard key={shop.shopId} shop={shop} />
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))
            )}
            {pending ? <p className="text-sm text-ink-500">Looking through the shops…</p> : null}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
          </div>

          <form
            className="flex gap-2 border-t border-ink-100 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(draft);
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={500}
              placeholder="Ask if a price is fair"
              aria-label="Ask about products"
              className="h-10 min-w-0 flex-1 rounded-xl border border-ink-200 bg-ink-50 px-3 text-sm focus:border-ink-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-400/60"
            />
            <Button type="submit" size="sm" aria-label="Send" loading={pending} disabled={!draft.trim()}>
              <Send className="size-4" />
            </Button>
          </form>
        </section>
      ) : null}

      {embedded ? null : (
        <button
          type="button"
          className="fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-ink-950 text-white shadow-pop hover:bg-ink-800"
          aria-label="Market analyst"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-5" /> : <Sparkles className="size-5" />}
        </button>
      )}
    </>
  );
}

function ProductCard({ product }: { product: AssistantProductCard }) {
  return (
    <li className="flex gap-3 rounded-xl border border-ink-100 p-2">
      <ImageWithFallback src={product.imageUrl} alt="" iconClassName="size-4" className="size-14 shrink-0 rounded-lg" />
      <div className="min-w-0">
        <Link to={`/products/${product.productId}`} className="text-sm font-semibold text-ink-950 hover:underline">
          {product.name}
        </Link>
        <p className="text-sm text-ink-700">{formatMoney(product.price)}</p>
        <p className="truncate text-xs text-ink-500">
          {product.shopName}
          {product.distanceKm ? ` · ${product.distanceKm} km away` : ''} · {product.inStock ? 'Available' : 'Unavailable'}
        </p>
        <Link to={`/shops/${product.shopSlug}`} className="text-xs font-medium text-accent-800 hover:underline">
          View shop
        </Link>
      </div>
    </li>
  );
}

function ShopCard({ shop }: { shop: AssistantShopCard }) {
  return (
    <li className="rounded-xl border border-ink-100 p-3 text-sm">
      <Link to={`/shops/${shop.slug}`} className="flex items-center gap-2 font-semibold text-ink-950 hover:underline">
        <Store className="size-4 text-accent-700" /> {shop.name}
      </Link>
      <p className="mt-1 text-ink-600">
        {shop.addressText}
        {shop.distanceKm ? ` · ${shop.distanceKm} km away` : ''}
      </p>
    </li>
  );
}
