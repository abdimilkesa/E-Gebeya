import {
  addCartItemSchema,
  checkoutQuoteSchema,
  mergeCartSchema,
  previewCartSchema,
  updateCartItemSchema,
} from '@marketplace/contracts';
import { Router } from 'express';
import { parseBody, sendData } from '../../lib/http.js';
import { idParam } from '../../lib/params.js';
import { authOf, guard } from '../../middleware/authenticate.js';
import * as cart from './cart.service.js';

export const cartRouter = Router();

// Public: guests keep their cart in the browser and ask the server to price it.
cartRouter.post('/preview', async (req, res) => {
  const { items } = parseBody(previewCartSchema, req);
  sendData(res, await cart.previewGuestCart(items));
});

cartRouter.use(guard('CUSTOMER'));

cartRouter.get('/', async (req, res) => {
  sendData(res, await cart.getCart(authOf(req).userId));
});

cartRouter.delete('/', async (req, res) => {
  sendData(res, await cart.clearCart(authOf(req).userId));
});

cartRouter.post('/items', async (req, res) => {
  const input = parseBody(addCartItemSchema, req);
  sendData(res, await cart.addItem(authOf(req).userId, input));
});

cartRouter.patch('/items/:itemId', async (req, res) => {
  const itemId = idParam(req, 'itemId', 'Cart item');
  const { quantity } = parseBody(updateCartItemSchema, req);
  sendData(res, await cart.updateItem(authOf(req).userId, itemId, quantity));
});

cartRouter.delete('/items/:itemId', async (req, res) => {
  const itemId = idParam(req, 'itemId', 'Cart item');
  sendData(res, await cart.removeItem(authOf(req).userId, itemId));
});

cartRouter.post('/merge', async (req, res) => {
  const { items } = parseBody(mergeCartSchema, req);
  sendData(res, await cart.mergeGuestCart(authOf(req).userId, items));
});

export const checkoutRouter = Router();
checkoutRouter.use(guard('CUSTOMER'));

checkoutRouter.post('/quote', async (req, res) => {
  const { fulfillmentPreference } = parseBody(checkoutQuoteSchema, req);
  sendData(res, await cart.quoteCheckout(authOf(req).userId, fulfillmentPreference));
});
