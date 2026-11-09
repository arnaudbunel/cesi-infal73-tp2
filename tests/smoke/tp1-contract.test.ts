// Suite d'acceptation du contrat cible (matrice T1-T8 du sujet).
// Des échecs sont attendus tant que l'API n'est pas conforme.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LightMyRequestResponse } from 'fastify';
import { buildApp } from '../../apps/order-service/src/app.js';

interface OrderBody {
  id: string;
  status: string;
  _links?: { self?: unknown; cancel?: unknown };
}

const validBody = { customerId: 'C200', items: [{ productId: 'P9', quantity: 2 }] };

function assertProblemDetails(res: LightMyRequestResponse, status: number): void {
  assert.equal(res.statusCode, status);
  assert.match(String(res.headers['content-type']), /^application\/problem\+json/);
  const body = res.json<Record<string, unknown>>();
  assert.equal(body['status'], status);
  for (const field of ['type', 'title', 'detail']) {
    assert.equal(typeof body[field], 'string', `Problem Details: champ "${field}" attendu`);
  }
}

describe('acceptance', () => {
  it('T1 - POST valide avec clé nouvelle : 201, Location, CREATED', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { 'idempotency-key': 'k-t1' },
      payload: validBody,
    });
    assert.equal(res.statusCode, 201);
    const order = res.json<OrderBody>();
    assert.equal(res.headers['location'], `/api/orders/${order.id}`);
    assert.equal(order.status, 'CREATED');
    await app.close();
  });

  it('T2 - quantity=-1 : 400 et Problem Details', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { 'idempotency-key': 'k-t2' },
      payload: { customerId: 'C200', items: [{ productId: 'P9', quantity: -1 }] },
    });
    assertProblemDetails(res, 400);
    await app.close();
  });

  it('T3 - GET inconnu : 404 et Problem Details', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/orders/ORD-999' });
    assertProblemDetails(res, 404);
    await app.close();
  });

  it('T4 - annuler ORD-103 (SHIPPED) : 409, état inchangé', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/orders/ORD-103/cancellations' });
    assert.equal(res.statusCode, 409);
    const after = await app.inject({ method: 'GET', url: '/api/orders/ORD-103' });
    assert.equal(after.json<OrderBody>().status, 'SHIPPED');
    await app.close();
  });

  it('T5 - même clé, même corps rejoués : même commande, pas de doublon', async () => {
    const app = buildApp();
    const send = () =>
      app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { 'idempotency-key': 'k-t5' },
        payload: validBody,
      });
    const first = await send();
    const second = await send();
    assert.equal(second.statusCode, first.statusCode);
    assert.equal(second.headers['location'], first.headers['location']);
    const list = await app.inject({ method: 'GET', url: '/api/orders' });
    assert.equal(list.json<OrderBody[]>().length, 5);
    await app.close();
  });

  it('T6 - même clé, corps différent : 409, aucune nouvelle commande', async () => {
    const app = buildApp();
    await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { 'idempotency-key': 'k-t6' },
      payload: validBody,
    });
    const other = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { 'idempotency-key': 'k-t6' },
      payload: { customerId: 'C201', items: [{ productId: 'P1', quantity: 5 }] },
    });
    assert.equal(other.statusCode, 409);
    const list = await app.inject({ method: 'GET', url: '/api/orders' });
    assert.equal(list.json<OrderBody[]>().length, 5);
    await app.close();
  });

  it('T7 - lien cancel présent pour ORD-102, absent pour ORD-103', async () => {
    const app = buildApp();
    const confirmed = (await app.inject({ method: 'GET', url: '/api/orders/ORD-102' })).json<OrderBody>();
    const shipped = (await app.inject({ method: 'GET', url: '/api/orders/ORD-103' })).json<OrderBody>();
    assert.ok(confirmed._links?.self, 'self attendu sur ORD-102');
    assert.ok(confirmed._links?.cancel, 'cancel attendu sur ORD-102');
    assert.ok(shipped._links?.self, 'self attendu sur ORD-103');
    assert.equal(shipped._links?.cancel, undefined, 'cancel interdit sur ORD-103');
    await app.close();
  });

  it('T8 - exception inattendue : 500 générique, aucune fuite', async () => {
    const app = buildApp({
      labMode: true,
      lab: {
        onRequest: () => {
          throw new Error('FICTIVE-INTERNAL-MESSAGE');
        },
      },
    });
    const res = await app.inject({ method: 'GET', url: '/api/orders' });
    assert.equal(res.statusCode, 500);
    assert.doesNotMatch(res.body, /FICTIVE-INTERNAL-MESSAGE/);
    assert.doesNotMatch(res.body, /\n\s+at /);
    assert.doesNotMatch(res.body, /stack/i);
    assertProblemDetails(res, 500);
    await app.close();
  });
});
