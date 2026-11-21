export interface OwnListing {
  id: string;
  name: string;
  price: string;
  categorySlug: string;
  categoryName: string;
}

export interface CatalogListing {
  id: string;
  name: string;
  price: string;
  canPurchase: boolean;
  categorySlug: string;
  shopId: string;
  shopName: string;
}

export interface OtherPrice {
  name: string;
  shopName: string;
  price: string;
}

export interface MarketComparison {
  productId: string;
  name: string;
  categoryName: string;
  price: string;
  onTheMarket: boolean;
  shoppersCanBuy: boolean;
  otherCount: number;
  averageOther: string | null;
  /** `only` and `one-other` have no average. The rest compare this price with the average of other shops. */
  position: 'only' | 'one-other' | 'below' | 'same' | 'above';
  others: OtherPrice[];
}

function toCents(price: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(price.trim());
  if (!match) return null;
  const whole = Number(match[1]);
  const frac = Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(frac)) return null;
  return whole * 100 + frac;
}

function fromCents(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const frac = String(Math.abs(cents % 100)).padStart(2, '0');
  return `${whole}.${frac}`;
}

/**
 * Compare a merchant's own prices with other shops' buyable listings in the same category.
 * The average exists only when at least two other shops have a buyable price. Nothing is invented.
 */
export function compareWithMarket(
  own: OwnListing[],
  catalog: CatalogListing[],
  shopIds: readonly string[],
): MarketComparison[] {
  const shops = new Set(shopIds);
  return own.map((product) => {
    const listed = catalog.find((item) => item.id === product.id);
    const others = catalog
      .filter(
        (item) =>
          item.categorySlug === product.categorySlug &&
          item.canPurchase &&
          !shops.has(item.shopId) &&
          toCents(item.price) !== null,
      )
      .sort((left, right) => (toCents(left.price) ?? 0) - (toCents(right.price) ?? 0) || left.name.localeCompare(right.name));
    const otherPrices = others.map((item) => ({ name: item.name, shopName: item.shopName, price: item.price }));
    const ownCents = toCents(product.price);
    const averageOther =
      others.length >= 2
        ? fromCents(Math.round(others.reduce((sum, item) => sum + (toCents(item.price) ?? 0), 0) / others.length))
        : null;
    const averageCents = averageOther === null ? null : toCents(averageOther);
    let position: MarketComparison['position'] = 'only';
    if (others.length === 1) position = 'one-other';
    else if (averageCents !== null && ownCents !== null) {
      if (ownCents < averageCents) position = 'below';
      else if (ownCents > averageCents) position = 'above';
      else position = 'same';
    }
    return {
      productId: product.id,
      name: product.name,
      categoryName: product.categoryName,
      price: product.price,
      onTheMarket: Boolean(listed),
      shoppersCanBuy: listed?.canPurchase ?? false,
      otherCount: others.length,
      averageOther,
      position,
      others: otherPrices,
    };
  });
}
