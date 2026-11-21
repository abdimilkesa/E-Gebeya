import { Router } from 'express';
import { adminRouter } from './modules/admin/admin.routes.js';
import { assistantRouter } from './modules/ai/assistant.routes.js';
import { cartRouter } from './modules/cart/cart.routes.js';
import { publicCatalogRouter } from './modules/catalog/public.routes.js';
import { customersRouter } from './modules/customers/customers.routes.js';
import { authRouter } from './modules/identity/auth.routes.js';
import { merchantRouter } from './modules/merchant/merchant.routes.js';
import { checkoutRouter, ordersRouter } from './modules/orders/orders.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/ai', assistantRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/merchant', merchantRouter);
apiRouter.use('/customers', customersRouter);
apiRouter.use('/cart', cartRouter);
apiRouter.use('/checkout', checkoutRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use(publicCatalogRouter);
