import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildApp } from '../../apps/order-service/src/app.js';

const validBody = { customerId: 'C200', items: [{ productId: 'P9', quantity: 2 }] };

describe('smoke', () => {
  it('liste les 4 commandes initiales', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/orders' });
    assert.equal(res.statusCode, 200);
    const ids = res.json<{ id: string; status: string }[]>().map((o) => `${o.id}:${o.status}`);
    assert.deepEqual(ids, [
      'ORD-101:CREATED',
      'ORD-102:CONFIRMED',
      'ORD-103:SHIPPED',
      'ORD-104:CANCELLED',
    ]);
    await app.close();
  });

  it('lit une commande existante', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/orders/ORD-101' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json<{ id: string }>().id, 'ORD-101');
    await app.close();
  });

  it('crée une commande', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { 'idempotency-key': 'smoke-1' },
      payload: validBody,
    });
    assert.equal(res.statusCode, 201);
    const created = res.json<{ id: string; status: string }>();
    assert.equal(res.headers['location'], `/api/orders/${created.id}`);
    assert.equal(created.status, 'CREATED');
    await app.close();
  });

  it('refuse une création sans Idempotency-Key', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/orders', payload: validBody });
    assert.equal(res.statusCode, 400);
    await app.close();
  });

  it('confirme une commande CREATED via PATCH', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/orders/ORD-101',
      payload: { status: 'CONFIRMED' },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json<{ status: string }>().status, 'CONFIRMED');
    await app.close();
  });

  it('annule une commande CREATED', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/orders/ORD-101/cancellations' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json<{ status: string }>().status, 'CANCELLED');
    await app.close();
  });

  it('repart de données neuves à chaque buildApp()', async () => {
    const first = buildApp();
    await first.inject({ method: 'POST', url: '/api/orders/ORD-101/cancellations' });
    await first.close();
    const second = buildApp();
    const res = await second.inject({ method: 'GET', url: '/api/orders/ORD-101' });
    assert.equal(res.json<{ status: string }>().status, 'CREATED');
    await second.close();
  });

  it('refuse le mode laboratoire en production', () => {
    const previous = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      assert.throws(() => buildApp({ labMode: true }));
    } finally {
      if (previous === undefined) delete process.env['NODE_ENV'];
      else process.env['NODE_ENV'] = previous;
    }
  });
});
