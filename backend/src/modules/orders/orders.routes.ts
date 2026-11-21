import {
  IDEMPOTENCY_HEADER,
  checkoutQuoteSchema,
  customerOrdersQuerySchema,
  idempotencyKeySchema,
  placeOrderSchema,
} from '@marketplace/contracts';
import { Router, type Request } from 'express';
import { validationError } from '../../lib/errors.js';
import { pageMeta, parseBody, parseQuery, sendData, sendPage } from '../../lib/http.js';
import { idParam } from '../../lib/params.js';
import { authOf, guard } from '../../middleware/authenticate.js';
import { checkoutLimiter } from '../../middleware/rate-limit.js';
import { quoteCheckout } from '../cart/cart.service.js';
import { placeOrder } from './checkout.service.js';
import { getCustomerOrder, listCustomerOrders } from './orders.service.js';

function idempotencyKeyOf(req: Request): string {
  const parsed = idempotencyKeySchema.safeParse(req.get(IDEMPOTENCY_HEADER));
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Send a valid Idempotency-Key header';
    throw validationError(message, [{ field: IDEMPOTENCY_HEADER, message }]);
  }
  return parsed.data;
}

export const checkoutRouter = Router();
checkoutRouter.use(guard('CUSTOMER'));

checkoutRouter.post('/quote', async (req, res) => {
  const { fulfillmentPreference } = parseBody(checkoutQuoteSchema, req);
  sendData(res, await quoteCheckout(authOf(req).userId, fulfillmentPreference));
});

checkoutRouter.post('/', checkoutLimiter, async (req, res) => {
  const key = idempotencyKeyOf(req);
  const input = parseBody(placeOrderSchema, req);
  sendData(res, await placeOrder(authOf(req).userId, key, input), 201);
});

export const ordersRouter = Router();
ordersRouter.use(guard('CUSTOMER'));

ordersRouter.get('/', async (req, res) => {
  const query = parseQuery(customerOrdersQuerySchema, req);
  const { items, total } = await listCustomerOrders(authOf(req).userId, query);
  sendPage(res, items, pageMeta(query.page, query.pageSize, total));
});

ordersRouter.get('/:orderId', async (req, res) => {
  const orderId = idParam(req, 'orderId', 'Order');
  sendData(res, await getCustomerOrder(authOf(req).userId, orderId));
});
