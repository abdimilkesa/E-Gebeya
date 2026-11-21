import { MAX_SAVED_ADDRESSES } from '@marketplace/contracts';
import { describe, expect, it } from 'vitest';
import { api, bearer, createAndLogin } from './helpers.js';

const home = { addressName: 'Mentina', houseNumber: '12', phoneNumber: '0911000000' };

describe('customer profile', () => {
  it('reads and renames the profile; the username cannot change', async () => {
    const customer = await createAndLogin('CUSTOMER', { username: 'liya', fullName: 'Liya Bekele' });
    const profile = await api().get('/api/v1/customers/me').set(bearer(customer.token)).expect(200);
    expect(profile.body.data).toEqual({ id: customer.user.id, fullName: 'Liya Bekele', username: 'liya' });

    const renamed = await api()
      .patch('/api/v1/customers/me')
      .set(bearer(customer.token))
      .send({ fullName: '  Liya B. Bekele ' })
      .expect(200);
    expect(renamed.body.data.fullName).toBe('Liya B. Bekele');

    await api()
      .patch('/api/v1/customers/me')
      .set(bearer(customer.token))
      .send({ fullName: 'Liya', username: 'admin' })
      .expect(400);
    await api().patch('/api/v1/customers/me').set(bearer(customer.token)).send({ fullName: 'L' }).expect(400);
  });

  it('is only for customers', async () => {
    const merchant = await createAndLogin('MERCHANT');
    await api().get('/api/v1/customers/me').set(bearer(merchant.token)).expect(403);
    await api().get('/api/v1/customers/me/addresses').expect(401);
  });
});

describe('saved addresses', () => {
  it('keeps exactly one default and lists it first', async () => {
    const customer = await createAndLogin('CUSTOMER', { fullName: 'Liya Bekele' });
    const book = () => api().get('/api/v1/customers/me/addresses').set(bearer(customer.token)).expect(200);
    const add = (body: object) =>
      api().post('/api/v1/customers/me/addresses').set(bearer(customer.token)).send(body).expect(201);

    const first = (await add(home)).body.data;
    expect(first).toMatchObject({ ...home, contactName: 'Liya Bekele', isDefault: true });

    const office = (await add({ addressName: 'Merkato', houseNumber: 'B-4', phoneNumber: '+251722000000' })).body
      .data;
    expect(office.isDefault).toBe(false);

    const work = (
      await add({ contactName: 'Abebe K.', addressName: 'Hermata', houseNumber: '7', phoneNumber: '0911 22 33 44', isDefault: true })
    ).body.data;
    expect(work).toMatchObject({ phoneNumber: '0911223344', isDefault: true });

    let list = (await book()).body.data;
    expect(list.map((address: { id: string }) => address.id)[0]).toBe(work.id);
    expect(list.filter((address: { isDefault: boolean }) => address.isDefault)).toHaveLength(1);

    await api()
      .patch(`/api/v1/customers/me/addresses/${office.id}`)
      .set(bearer(customer.token))
      .send({ isDefault: true, houseNumber: 'B-5' })
      .expect(200);
    list = (await book()).body.data;
    expect(list[0]).toMatchObject({ id: office.id, houseNumber: 'B-5', isDefault: true });
    expect(list.filter((address: { isDefault: boolean }) => address.isDefault)).toHaveLength(1);

    await api()
      .delete(`/api/v1/customers/me/addresses/${first.id}`)
      .set(bearer(customer.token))
      .expect(200, { success: true, data: { deleted: true }, error: null, meta: {} });
    expect((await book()).body.data).toHaveLength(2);
  });

  it("validates input and hides other customers' addresses", async () => {
    const owner = await createAndLogin('CUSTOMER');
    const other = await createAndLogin('CUSTOMER');
    const address = (
      await api().post('/api/v1/customers/me/addresses').set(bearer(owner.token)).send(home).expect(201)
    ).body.data;

    const post = (body: object) =>
      api().post('/api/v1/customers/me/addresses').set(bearer(owner.token)).send(body);
    await post({ ...home, phoneNumber: '0471112233' }).expect(400);
    await post({ ...home, houseNumber: '' }).expect(400);
    await post({ ...home, userId: other.user.id }).expect(400);
    await api()
      .patch(`/api/v1/customers/me/addresses/${address.id}`)
      .set(bearer(owner.token))
      .send({})
      .expect(400);

    await api()
      .patch(`/api/v1/customers/me/addresses/${address.id}`)
      .set(bearer(other.token))
      .send({ houseNumber: '99' })
      .expect(404);
    await api().delete(`/api/v1/customers/me/addresses/${address.id}`).set(bearer(other.token)).expect(404);
    const otherBook = await api().get('/api/v1/customers/me/addresses').set(bearer(other.token)).expect(200);
    expect(otherBook.body.data).toEqual([]);
  });

  it(`stops at ${MAX_SAVED_ADDRESSES} addresses`, async () => {
    const customer = await createAndLogin('CUSTOMER');
    for (let index = 0; index < MAX_SAVED_ADDRESSES; index += 1) {
      await api()
        .post('/api/v1/customers/me/addresses')
        .set(bearer(customer.token))
        .send({ ...home, houseNumber: String(index) })
        .expect(201);
    }
    const full = await api()
      .post('/api/v1/customers/me/addresses')
      .set(bearer(customer.token))
      .send(home)
      .expect(422);
    expect(full.body.error.code).toBe('BUSINESS_RULE');
  });
});
