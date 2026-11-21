import { publicProductsQuerySchema, publicShopsQuerySchema } from '@marketplace/contracts';
import { Router } from 'express';
import { pageMeta, parseQuery, sendData, sendPage } from '../../lib/http.js';
import { idParam, slugParam } from '../../lib/params.js';
import * as catalog from './public.service.js';

/** Anonymous catalog reads: no bank details, no stock counts, hidden shops return 404. */
export const publicCatalogRouter = Router();

publicCatalogRouter.get('/categories', async (_req, res) => {
  sendData(res, await catalog.listActiveCategories());
});

publicCatalogRouter.get('/shops', async (req, res) => {
  const query = parseQuery(publicShopsQuerySchema, req);
  const { items, total } = await catalog.listPublicShops(query);
  sendPage(res, items, pageMeta(query.page, query.pageSize, total));
});

publicCatalogRouter.get('/shops/:slug', async (req, res) => {
  sendData(res, await catalog.getPublicShop(slugParam(req, 'slug', 'Shop')));
});

publicCatalogRouter.get('/products', async (req, res) => {
  const query = parseQuery(publicProductsQuerySchema, req);
  const { items, total } = await catalog.listPublicProducts(query);
  sendPage(res, items, pageMeta(query.page, query.pageSize, total));
});

publicCatalogRouter.get('/products/:productId', async (req, res) => {
  sendData(res, await catalog.getPublicProduct(idParam(req, 'productId', 'Product')));
});
