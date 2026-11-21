import { createAddressSchema, updateAddressSchema, updateProfileSchema } from '@marketplace/contracts';
import { Router } from 'express';
import { parseBody, sendData } from '../../lib/http.js';
import { idParam } from '../../lib/params.js';
import { authOf, guard } from '../../middleware/authenticate.js';
import * as customers from './customers.service.js';

export const customersRouter = Router();
customersRouter.use(guard('CUSTOMER'));

customersRouter.get('/me', async (req, res) => {
  sendData(res, await customers.getProfile(authOf(req).userId));
});

customersRouter.patch('/me', async (req, res) => {
  const input = parseBody(updateProfileSchema, req);
  sendData(res, await customers.updateProfile(authOf(req).userId, input));
});

customersRouter.get('/me/addresses', async (req, res) => {
  sendData(res, await customers.listAddresses(authOf(req).userId));
});

customersRouter.post('/me/addresses', async (req, res) => {
  const input = parseBody(createAddressSchema, req);
  sendData(res, await customers.addAddress(authOf(req).userId, input), 201);
});

customersRouter.patch('/me/addresses/:addressId', async (req, res) => {
  const addressId = idParam(req, 'addressId', 'Address');
  const input = parseBody(updateAddressSchema, req);
  sendData(res, await customers.updateAddress(authOf(req).userId, addressId, input));
});

customersRouter.delete('/me/addresses/:addressId', async (req, res) => {
  const addressId = idParam(req, 'addressId', 'Address');
  sendData(res, await customers.deleteAddress(authOf(req).userId, addressId));
});
