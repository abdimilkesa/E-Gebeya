import { createHash } from 'node:crypto';
import {
  BUSINESS_TIME_ZONE,
  MAX_SAVED_ADDRESSES,
  type ApiErrorDetail,
  type CheckoutResult,
  type DeliveryContact,
  type FulfillmentPreference,
  type LineIssue,
  type PaymentMethod,
  type PlaceOrderInput,
} from '@marketplace/contracts';
import { Prisma } from '../../generated/prisma/client.js';
import { businessRule, conflict, validationError } from '../../lib/errors.js';
import { Decimal } from '../../lib/format.js';
import { prisma, type DbClient } from '../../lib/prisma.js';
import { isUniqueViolation } from '../../lib/prisma-errors.js';
import { cartProductSelect, lineIssue } from '../cart/cart.service.js';
import { createAddress, findOwnAddress, getProfile } from '../customers/customers.service.js';
import { availablePaymentMethods } from '../payments/payment-methods.js';
import { getCustomerOrder } from './orders.service.js';

/** How long unpaid stock stays reserved (docs UD-08). */
export const STOCK_HOLD_MINUTES: Record<PaymentMethod, number> = {
  CHAPA: 30,
  BANK_TRANSFER: 48 * 60,
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CHAPA: 'Online payment with Chapa',
  BANK_TRANSFER: 'Bank transfer',
};

const ISSUE_MESSAGES: Record<LineIssue, (name: string) => string> = {
  NOT_FOUND: (name) => `${name} is no longer for sale.`,
  UNAVAILABLE: (name) => `${name} is currently unavailable.`,
  INSUFFICIENT_STOCK: (name) => `There is not enough stock of ${name} for the quantity in your cart.`,
};

const checkoutProductSelect = {
  ...cartProductSelect,
  shop: { select: { ...cartProductSelect.shop.select, merchantId: true } },
} satisfies Prisma.ProductSelect;

type CheckoutProduct = Prisma.ProductGetPayload<{ select: typeof checkoutProductSelect }>;

interface CartLineRow {
  id: string;
  productId: string;
  quantity: number;
}

interface SubOrderDraft {
  shopId: string;
  merchantId: string;
  shopName: string;
  subtotal: Decimal;
  deliveryFee: Decimal;
  items: {
    productId: string;
    productNameSnapshot: string;
    unitPriceSnapshot: Decimal;
    quantity: number;
    lineTotal: Decimal;
  }[];
}

/** Same body, same hash: key order and omitted optional fields do not matter. */
function fingerprint(input: PlaceOrderInput): string {
  const entries = Object.entries(input)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}

/** The order a previous request with this key created, or null. A different body is a conflict. */
async function replayedOrderId(
  db: DbClient,
  customerId: string,
  key: string,
  hash: string,
): Promise<string | null> {
  const existing = await db.order.findFirst({
    where: { customerId, clientRequestId: key },
    select: { id: true, clientRequestHash: true },
  });
  if (!existing) return null;
  if (existing.clientRequestHash !== hash) {
    throw conflict('This Idempotency-Key was already used for a different checkout.');
  }
  return existing.id;
}

async function resolveContact(
  db: DbClient,
  customerId: string,
  input: PlaceOrderInput,
): Promise<DeliveryContact> {
  if (input.addressId) {
    const address = await findOwnAddress(db, customerId, input.addressId);
    return {
      contactName: address.contactName,
      addressName: address.addressName,
      houseNumber: address.houseNumber,
      phoneNumber: address.phoneNumber,
    };
  }
  const { addressName, houseNumber, phoneNumber } = input;
  if (!addressName || !houseNumber || !phoneNumber) {
    throw validationError('Choose or enter a delivery address.');
  }
  const contactName = input.contactName ?? (await getProfile(customerId, db)).fullName;
  return { contactName, addressName, houseNumber, phoneNumber };
}

/** Adds a typed contact to the address book unless it is already there or the book is full. */
async function rememberAddress(db: DbClient, customerId: string, contact: DeliveryContact) {
  const saved = await db.customerAddress.findMany({
    where: { userId: customerId },
    select: { contactName: true, addressName: true, houseNumber: true, phoneNumber: true },
  });
  const known = saved.some(
    (address) =>
      address.contactName === contact.contactName &&
      address.addressName === contact.addressName &&
      address.houseNumber === contact.houseNumber &&
      address.phoneNumber === contact.phoneNumber,
  );
  if (known || saved.length >= MAX_SAVED_ADDRESSES) return;
  await createAddress(db, customerId, contact.contactName, contact);
}

/** Groups validated lines by shop, in the order the shops first appear in the cart. */
function draftSubOrders(
  lines: { line: CartLineRow; product: CheckoutProduct }[],
  preference: FulfillmentPreference,
): SubOrderDraft[] {
  const drafts = new Map<string, SubOrderDraft>();
  for (const { line, product } of lines) {
    let draft = drafts.get(product.shop.id);
    if (!draft) {
      draft = {
        shopId: product.shop.id,
        merchantId: product.shop.merchantId,
        shopName: product.shop.name,
        subtotal: new Decimal(0),
        deliveryFee: preference === 'DELIVERY' ? product.shop.deliveryFeeEtb : new Decimal(0),
        items: [],
      };
      drafts.set(product.shop.id, draft);
    }
    const lineTotal = product.price.mul(line.quantity);
    draft.items.push({
      productId: product.id,
      productNameSnapshot: product.name,
      unitPriceSnapshot: product.price,
      quantity: line.quantity,
      lineTotal,
    });
    draft.subtotal = draft.subtotal.add(lineTotal);
  }
  return [...drafts.values()];
}

/** `ORD-<Addis Ababa date>-<sequence>`; the sequence makes numbers unique under concurrency. */
async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const [row] = await tx.$queryRaw<{ seq: bigint; day: string }[]>`
    SELECT nextval('order_number_seq') AS seq,
           to_char(now() AT TIME ZONE ${BUSINESS_TIME_ZONE}, 'YYYYMMDD') AS day`;
  if (!row) throw new Error('order_number_seq returned no row');
  return `ORD-${row.day}-${String(row.seq).padStart(4, '0')}`;
}

async function createOrder(
  tx: Prisma.TransactionClient,
  customerId: string,
  key: string,
  hash: string,
  input: PlaceOrderInput,
): Promise<string> {
  // Serializes this customer's checkouts: a concurrent retry waits here, then finds the order.
  const [cart] = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM carts WHERE user_id = ${customerId}::uuid FOR UPDATE`;
  const replayId = await replayedOrderId(tx, customerId, key, hash);
  if (replayId) return replayId;

  const lines: CartLineRow[] = cart
    ? await tx.cartItem.findMany({
        where: { cartId: cart.id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, productId: true, quantity: true },
      })
    : [];
  if (!cart || lines.length === 0) throw businessRule('Your cart is empty.');

  const contact = await resolveContact(tx, customerId, input);

  // Product rows are locked in id order so two checkouts can never deadlock each other.
  const productIds = lines.map((line) => line.productId);
  await tx.$queryRaw`
    SELECT id FROM products
    WHERE id IN (${Prisma.join(productIds.map((id) => Prisma.sql`${id}::uuid`))})
    ORDER BY id
    FOR UPDATE`;
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: checkoutProductSelect,
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  const valid: { line: CartLineRow; product: CheckoutProduct }[] = [];
  const problems: ApiErrorDetail[] = [];
  for (const line of lines) {
    const product = byId.get(line.productId);
    const issue = lineIssue(product, line.quantity);
    if (issue || !product) {
      const name = product?.name ?? 'A product';
      problems.push({ field: `items.${line.id}`, message: ISSUE_MESSAGES[issue ?? 'NOT_FOUND'](name) });
    } else {
      valid.push({ line, product });
    }
  }
  if (problems.length > 0) {
    const [only] = problems;
    throw businessRule(
      problems.length === 1 && only ? only.message : 'Some items in your cart cannot be bought right now.',
      problems,
    );
  }

  const drafts = draftSubOrders(valid, input.fulfillmentPreference);
  const merchandiseSubtotal = drafts.reduce((sum, draft) => sum.add(draft.subtotal), new Decimal(0));
  const deliveryFeeTotal = drafts.reduce((sum, draft) => sum.add(draft.deliveryFee), new Decimal(0));
  const customerNote = input.customerNote ?? null;

  const order = await tx.order.create({
    data: {
      orderNumber: await nextOrderNumber(tx),
      customerId,
      clientRequestId: key,
      clientRequestHash: hash,
      fulfillmentPreference: input.fulfillmentPreference,
      ...contact,
      customerNote,
      paymentMethod: input.paymentMethod,
      merchandiseSubtotal,
      deliveryFeeTotal,
      grandTotal: merchandiseSubtotal.add(deliveryFeeTotal),
      paymentStatus: 'UNPAID',
      fulfillmentStatus: 'PENDING_PAYMENT',
      stockHoldState: 'HELD',
      stockHoldExpiresAt: new Date(Date.now() + STOCK_HOLD_MINUTES[input.paymentMethod] * 60_000),
      merchantOrders: {
        create: drafts.map((draft) => ({
          shopId: draft.shopId,
          merchantId: draft.merchantId,
          shopNameSnapshot: draft.shopName,
          ...contact,
          customerNote,
          subtotal: draft.subtotal,
          deliveryFee: draft.deliveryFee,
          total: draft.subtotal.add(draft.deliveryFee),
          paymentStatus: 'PENDING',
          fulfillmentStatus: 'AWAITING_PAYMENT',
          items: { create: draft.items },
        })),
      },
    },
    select: { id: true, merchantOrders: { select: { id: true, total: true } } },
  });

  if (input.paymentMethod !== 'BANK_TRANSFER') {
    throw new Error(`No payment rows are defined for ${input.paymentMethod}`);
  }
  // Each merchant is paid directly into their own account, so each sub-order is its own receivable.
  await tx.payment.createMany({
    data: order.merchantOrders.map((merchantOrder) => ({
      orderId: order.id,
      merchantOrderId: merchantOrder.id,
      method: 'BANK_TRANSFER' as const,
      provider: 'MANUAL' as const,
      amount: merchantOrder.total,
      status: 'PENDING' as const,
    })),
  });

  for (const { line } of valid) {
    await tx.product.update({
      where: { id: line.productId },
      data: { stockQuantity: { decrement: line.quantity } },
    });
  }

  if (input.saveAddress && !input.addressId) await rememberAddress(tx, customerId, contact);
  await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
  return order.id;
}

const checkoutResult = async (customerId: string, orderId: string): Promise<CheckoutResult> => ({
  order: await getCustomerOrder(customerId, orderId),
  chapa: null,
});

/**
 * Turns the customer's server cart into one parent order and one sub-order per shop, in a
 * single transaction: every line is re-validated under row locks, prices and names are
 * copied onto the items, stock is held, payment rows are written and the cart is emptied.
 * Any bad line fails the whole checkout and nothing is written.
 */
export async function placeOrder(
  customerId: string,
  idempotencyKey: string,
  input: PlaceOrderInput,
): Promise<CheckoutResult> {
  const hash = fingerprint(input);
  const replayId = await replayedOrderId(prisma, customerId, idempotencyKey, hash);
  if (replayId) return checkoutResult(customerId, replayId);

  if (!availablePaymentMethods().includes(input.paymentMethod)) {
    throw businessRule(`${METHOD_LABELS[input.paymentMethod]} is not available yet. Choose bank transfer.`, [
      { field: 'paymentMethod', message: 'This payment method is not available' },
    ]);
  }

  try {
    const orderId = await prisma.$transaction(
      (tx) => createOrder(tx, customerId, idempotencyKey, hash, input),
      { maxWait: 5_000, timeout: 15_000 },
    );
    return await checkoutResult(customerId, orderId);
  } catch (error) {
    // Two requests with the same key raced past the first check; the loser replays the winner.
    if (isUniqueViolation(error, 'client_request') || isUniqueViolation(error, 'clientRequest')) {
      const winnerId = await replayedOrderId(prisma, customerId, idempotencyKey, hash);
      if (winnerId) return checkoutResult(customerId, winnerId);
    }
    throw error;
  }
}
