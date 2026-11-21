import {
  createProductSchema,
  merchantProductsQuerySchema,
  updateMerchantProfileSchema,
  updateProductSchema,
} from '@marketplace/contracts';
import { Router } from 'express';
import { pageMeta, parseBody, parseQuery, sendData, sendPage } from '../../lib/http.js';
import { idParam } from '../../lib/params.js';
import { authOf, guard } from '../../middleware/authenticate.js';
import { uploadLimiter } from '../../middleware/rate-limit.js';
import { auditActor } from '../audit/audit.service.js';
import { imageUpload } from '../media/upload.js';
import * as merchant from './merchant.service.js';

export const merchantRouter = Router();
merchantRouter.use(guard('MERCHANT'));

merchantRouter.get('/dashboard', async (req, res) => {
  sendData(res, await merchant.getDashboard(authOf(req).userId));
});

merchantRouter.get('/shops', async (req, res) => {
  sendData(res, await merchant.listShops(authOf(req).userId));
});

merchantRouter.get('/products', async (req, res) => {
  const query = parseQuery(merchantProductsQuerySchema, req);
  const { items, total } = await merchant.listProducts(authOf(req).userId, query);
  sendPage(res, items, pageMeta(query.page, query.pageSize, total));
});

merchantRouter.post('/products', async (req, res) => {
  const input = parseBody(createProductSchema, req);
  sendData(res, await merchant.createProduct(authOf(req).userId, input, auditActor(req)), 201);
});

merchantRouter.get('/products/:productId', async (req, res) => {
  const productId = idParam(req, 'productId', 'Product');
  sendData(res, await merchant.getProduct(authOf(req).userId, productId));
});

merchantRouter.patch('/products/:productId', async (req, res) => {
  const productId = idParam(req, 'productId', 'Product');
  const input = parseBody(updateProductSchema, req);
  sendData(
    res,
    await merchant.updateProduct(authOf(req).userId, productId, input, auditActor(req)),
  );
});

merchantRouter.delete('/products/:productId', async (req, res) => {
  const productId = idParam(req, 'productId', 'Product');
  sendData(res, await merchant.archiveProduct(authOf(req).userId, productId, auditActor(req)));
});

merchantRouter.post('/products/:productId/restore', async (req, res) => {
  const productId = idParam(req, 'productId', 'Product');
  sendData(res, await merchant.restoreProduct(authOf(req).userId, productId, auditActor(req)));
});

merchantRouter.post('/uploads/images', uploadLimiter, ...imageUpload('products'));

merchantRouter.get('/profile', async (req, res) => {
  sendData(res, await merchant.getProfile(authOf(req).userId));
});

merchantRouter.patch('/profile', async (req, res) => {
  const input = parseBody(updateMerchantProfileSchema, req);
  sendData(res, await merchant.updateProfile(authOf(req).userId, input));
});
