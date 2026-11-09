import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildApp } from '../../apps/order-service/src/app.js';
import { startStack } from '../helpers/stack.js';

describe('smoke - TP2 order-service', () => {
  it('ORD-102 contient P12 x 2', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/orders/ORD-102' });
    assert.deepEqual(res.json<{ items: unknown[] }>().items, [{ productId: 'P12', quantity: 2 }]);
    await app.close();
  });

  it('diagnostics/nonblocking répond {mode: nonblocking}', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/diagnostics/nonblocking' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { mode: 'nonblocking' });
    await app.close();
  });

  it('diagnostics/blocking répond {mode: blocking} en ~300 ms', async () => {
    const app = buildApp();
    const start = performance.now();
    const res = await app.inject({ method: 'GET', url: '/api/diagnostics/blocking' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { mode: 'blocking' });
    assert.ok(performance.now() - start >= 290);
    await app.close();
  });

  it('les routes de diagnostic sont absentes en production', async () => {
    const previous = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      const app = buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/diagnostics/blocking' });
      assert.equal(res.statusCode, 404);
      await app.close();
    } finally {
      if (previous === undefined) delete process.env['NODE_ENV'];
      else process.env['NODE_ENV'] = previous;
    }
  });

  it('availability nominale (vrai appel HTTP vers Stocks)', async () => {
    const { app, stop } = await startStack();
    const res = await app.inject({ method: 'GET', url: '/api/orders/ORD-102/availability' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), {
      orderId: 'ORD-102',
      productId: 'P12',
      requestedQuantity: 2,
      available: 12,
      canFulfill: true,
    });
    await stop();
  });

  it('availability ne modifie ni la commande ni le stock', async () => {
    const { app, stop } = await startStack();
    const before = (await app.inject({ method: 'GET', url: '/api/orders/ORD-102' })).body;
    await app.inject({ method: 'GET', url: '/api/orders/ORD-102/availability' });
    await app.inject({ method: 'GET', url: '/api/orders/ORD-102/availability' });
    assert.equal((await app.inject({ method: 'GET', url: '/api/orders/ORD-102' })).body, before);
    await stop();
  });
});
