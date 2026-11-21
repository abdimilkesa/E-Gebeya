import {
  adminShopsQuerySchema,
  adminUsersQuerySchema,
  auditLogsQuerySchema,
  createCategorySchema,
  createMerchantSchema,
  createShopSchema,
  resetPasswordSchema,
  updateCategorySchema,
  updateMerchantSchema,
  updateShopSchema,
  userStatusUpdateSchema,
} from '@marketplace/contracts';
import { Router } from 'express';
import { pageMeta, parseBody, parseQuery, sendData, sendPage } from '../../lib/http.js';
import { idParam } from '../../lib/params.js';
import { guard } from '../../middleware/authenticate.js';
import { uploadLimiter } from '../../middleware/rate-limit.js';
import { listAuditLogs } from '../audit/audit-logs.service.js';
import { auditActor } from '../audit/audit.service.js';
import { imageUpload } from '../media/upload.js';
import * as categories from './categories.service.js';
import { getOverview } from './overview.service.js';
import * as shops from './shops.service.js';
import * as users from './users.service.js';

export const adminRouter = Router();
adminRouter.use(guard('SUPER_ADMIN'));

adminRouter.get('/overview', async (_req, res) => {
  sendData(res, await getOverview());
});

/* ---- Categories ---- */

adminRouter.get('/categories', async (_req, res) => {
  sendData(res, await categories.listCategories());
});

adminRouter.post('/categories', async (req, res) => {
  const input = parseBody(createCategorySchema, req);
  sendData(res, await categories.createCategory(input, auditActor(req)), 201);
});

adminRouter.patch('/categories/:categoryId', async (req, res) => {
  const id = idParam(req, 'categoryId', 'Category');
  const input = parseBody(updateCategorySchema, req);
  sendData(res, await categories.updateCategory(id, input, auditActor(req)));
});

/* ---- Merchants ---- */

adminRouter.get('/merchants', async (req, res) => {
  const query = parseQuery(adminUsersQuerySchema, req);
  const { items, total } = await users.listMerchants(query);
  sendPage(res, items, pageMeta(query.page, query.pageSize, total));
});

adminRouter.post('/merchants', async (req, res) => {
  const input = parseBody(createMerchantSchema, req);
  sendData(res, await users.createMerchant(input, auditActor(req)), 201);
});

adminRouter.get('/merchants/:userId', async (req, res) => {
  sendData(res, await users.getMerchant(idParam(req, 'userId', 'Merchant')));
});

adminRouter.patch('/merchants/:userId', async (req, res) => {
  const id = idParam(req, 'userId', 'Merchant');
  const input = parseBody(updateMerchantSchema, req);
  sendData(res, await users.updateMerchant(id, input, auditActor(req)));
});

adminRouter.patch('/merchants/:userId/status', async (req, res) => {
  const id = idParam(req, 'userId', 'Merchant');
  const { status } = parseBody(userStatusUpdateSchema, req);
  sendData(res, await users.setAccountStatus(id, 'MERCHANT', status, auditActor(req)));
});

adminRouter.post('/merchants/:userId/reset-password', async (req, res) => {
  const id = idParam(req, 'userId', 'Merchant');
  const input = parseBody(resetPasswordSchema, req);
  sendData(res, await users.resetMerchantPassword(id, input, auditActor(req)));
});

/* ---- Customers ---- */

adminRouter.get('/customers', async (req, res) => {
  const query = parseQuery(adminUsersQuerySchema, req);
  const { items, total } = await users.listCustomers(query);
  sendPage(res, items, pageMeta(query.page, query.pageSize, total));
});

adminRouter.get('/customers/:userId', async (req, res) => {
  sendData(res, await users.getCustomer(idParam(req, 'userId', 'Customer')));
});

adminRouter.patch('/customers/:userId/status', async (req, res) => {
  const id = idParam(req, 'userId', 'Customer');
  const { status } = parseBody(userStatusUpdateSchema, req);
  sendData(res, await users.setAccountStatus(id, 'CUSTOMER', status, auditActor(req)));
});

/* ---- Shops ---- */

adminRouter.get('/shops', async (req, res) => {
  const query = parseQuery(adminShopsQuerySchema, req);
  const { items, total } = await shops.listShops(query);
  sendPage(res, items, pageMeta(query.page, query.pageSize, total));
});

adminRouter.post('/shops', async (req, res) => {
  const input = parseBody(createShopSchema, req);
  sendData(res, await shops.createShop(input, auditActor(req)), 201);
});

adminRouter.get('/shops/:shopId', async (req, res) => {
  sendData(res, await shops.getShop(idParam(req, 'shopId', 'Shop')));
});

adminRouter.patch('/shops/:shopId', async (req, res) => {
  const id = idParam(req, 'shopId', 'Shop');
  const input = parseBody(updateShopSchema, req);
  sendData(res, await shops.updateShop(id, input, auditActor(req)));
});

/* ---- Shop branding uploads ---- */

adminRouter.post('/uploads/images', uploadLimiter, ...imageUpload('shops'));

/* ---- Audit log ---- */

adminRouter.get('/audit-logs', async (req, res) => {
  const query = parseQuery(auditLogsQuerySchema, req);
  const { items, total } = await listAuditLogs(query);
  sendPage(res, items, pageMeta(query.page, query.pageSize, total));
});
