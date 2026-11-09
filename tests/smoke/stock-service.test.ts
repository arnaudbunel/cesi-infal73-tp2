import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildStockApp } from '../../apps/stock-service/src/app.js';
import { readStockConfig } from '../../apps/stock-service/src/config.js';
import { close, listen } from '../helpers/stack.js';

describe('smoke - stock-service', () => {
  it('GET /stock/P12 renvoie 12 unités', async () => {
    const server = buildStockApp();
    const port = await listen(server);
    const res = await fetch(`http://127.0.0.1:${port}/stock/P12`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { productId: 'P12', available: 12 });
    await close(server);
  });

  it('applique la latence configurée', async () => {
    const server = buildStockApp({ latencyMs: 150 });
    const port = await listen(server);
    const start = performance.now();
    await (await fetch(`http://127.0.0.1:${port}/stock/P12`)).json();
    assert.ok(performance.now() - start >= 140);
    await close(server);
  });

  it('status503 : renvoie 503', async () => {
    const server = buildStockApp({ mode: 'status503' });
    const port = await listen(server);
    assert.equal((await fetch(`http://127.0.0.1:${port}/stock/P12`)).status, 503);
    await close(server);
  });

  it('invalid_json : corps JSON syntaxiquement invalide', async () => {
    const server = buildStockApp({ mode: 'invalid_json' });
    const port = await listen(server);
    const res = await fetch(`http://127.0.0.1:${port}/stock/P12`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /json/);
    await assert.rejects(res.json(), SyntaxError);
    await close(server);
  });

  it('disconnect : la connexion est coupée pendant le corps', async () => {
    const server = buildStockApp({ mode: 'disconnect' });
    const port = await listen(server);
    const res = await fetch(`http://127.0.0.1:${port}/stock/P12`);
    assert.equal(res.status, 200); // les en-têtes sont bien arrivés
    await assert.rejects(res.text());
    await close(server);
  });

  it('refuse une configuration invalide', () => {
    assert.throws(() => readStockConfig({ STOCK_MODE: 'boom' }));
    assert.throws(() => readStockConfig({ STOCK_LATENCY_MS: '-5' }));
    assert.deepEqual(readStockConfig({ STOCK_LATENCY_MS: '300', STOCK_MODE: 'normal' }).latencyMs, 300);
  });
});
