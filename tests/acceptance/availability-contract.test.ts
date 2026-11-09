// Contrat cible de GET /api/orders/:id/availability.
// Des échecs sont attendus au départ : c'est votre travail de les faire passer, sans casser `npm test`.
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { close, freePort, startCustomStock, startStack } from '../helpers/stack.js';
import type { Stack } from '../helpers/stack.js';
import { buildApp } from '../../apps/order-service/src/app.js';
import type { StockConfig } from '../../apps/stock-service/src/config.js';

const URL_AVAILABILITY = '/api/orders/ORD-102/availability';
const FORBIDDEN_LEAKS = /ECONN|fetch failed|SyntaxError|UND_ERR|terminated|Unexpected|at .*\.(ts|js):\d+|node_modules/i;

let cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const fn of cleanup.reverse()) await fn();
  cleanup = [];
});

async function stack(stock: Partial<StockConfig> = {}): Promise<Stack> {
  const s = await startStack(stock);
  cleanup.push(s.stop);
  return s;
}

function assertProblem(res: { statusCode: number; headers: Record<string, unknown>; body: string }, status: number): void {
  assert.equal(res.statusCode, status, `statut attendu ${status}, reçu ${res.statusCode} : ${res.body}`);
  assert.match(String(res.headers['content-type']), /^application\/problem\+json/);
  const body = JSON.parse(res.body) as { status: number; title: string; type: string; detail: string };
  assert.equal(body.status, status);
  assert.ok(body.title && body.type && body.detail);
  assert.doesNotMatch(res.body, FORBIDDEN_LEAKS, 'la réponse ne doit pas exposer de détail interne');
}

/** Stocks « sur mesure » renvoyant un corps JSON arbitraire. */
async function withCustomStock(status: number, body: string) {
  const custom = await startCustomStock(status, body);
  cleanup.push(custom.stop);
  const app = buildApp({ stockBaseUrl: `http://127.0.0.1:${custom.port}` });
  cleanup.push(() => app.close());
  return app.inject({ method: 'GET', url: URL_AVAILABILITY });
}

describe('availability - contrat nominal', () => {
  it('N1 - ORD-102 : P12 x 2, 12 disponibles, canFulfill vrai', async () => {
    const { app } = await stack();
    const res = await app.inject({ method: 'GET', url: URL_AVAILABILITY });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { orderId: 'ORD-102', productId: 'P12', requestedQuantity: 2, available: 12, canFulfill: true });
  });

  it('N2 - canFulfill est calculé côté Commandes (stock insuffisant)', async () => {
    const { app } = await stack({ available: 1 });
    const res = await app.inject({ method: 'GET', url: URL_AVAILABILITY });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json<{ canFulfill: boolean }>().canFulfill, false);
    assert.equal(res.json<{ available: number }>().available, 1);
  });

  it('N3 - commande inconnue : 404 problem+json', async () => {
    const { app } = await stack();
    const res = await app.inject({ method: 'GET', url: '/api/orders/ORD-999/availability' });
    assertProblem(res, 404);
  });
});

describe('availability - incidents Stocks', () => {
  it('F1 - Stocks répond en 3 s : 504 avant ~2,5 s', { timeout: 8000 }, async () => {
    const { app } = await stack({ latencyMs: 3000 });
    const start = performance.now();
    const res = await app.inject({ method: 'GET', url: URL_AVAILABILITY });
    const elapsed = performance.now() - start;
    assertProblem(res, 504);
    assert.ok(elapsed < 2600, `le budget total de 2000 ms doit être respecté (mesuré : ${Math.round(elapsed)} ms)`);
  });

  it('F2 - Stocks répond 503 : 503', async () => {
    const { app } = await stack({ mode: 'status503' });
    assertProblem(await app.inject({ method: 'GET', url: URL_AVAILABILITY }), 503);
  });

  it('F3 - connexion refusée : 502', async () => {
    const port = await freePort();
    const app = buildApp({ stockBaseUrl: `http://127.0.0.1:${port}` });
    cleanup.push(() => app.close());
    assertProblem(await app.inject({ method: 'GET', url: URL_AVAILABILITY }), 502);
  });

  it('F4a - JSON malformé : 502', async () => {
    const { app } = await stack({ mode: 'invalid_json' });
    assertProblem(await app.inject({ method: 'GET', url: URL_AVAILABILITY }), 502);
  });

  it('F4b - productId différent de celui demandé : 502', async () => {
    assertProblem(await withCustomStock(200, '{"productId":"P99","available":12}'), 502);
  });

  it('F4c - available négatif : 502', async () => {
    assertProblem(await withCustomStock(200, '{"productId":"P12","available":-1}'), 502);
  });

  it('F4d - available non entier : 502', async () => {
    assertProblem(await withCustomStock(200, '{"productId":"P12","available":"12"}'), 502);
    assertProblem(await withCustomStock(200, '{"productId":"P12","available":1.5}'), 502);
  });

  it('F4e - corps null ou champ manquant : 502', async () => {
    assertProblem(await withCustomStock(200, 'null'), 502);
    assertProblem(await withCustomStock(200, '{"productId":"P12"}'), 502);
  });

  it('F5 - réponse coupée en cours de corps : 502 (ou 504 si le délai expire)', async () => {
    const { app } = await stack({ mode: 'disconnect' });
    const res = await app.inject({ method: 'GET', url: URL_AVAILABILITY });
    assert.ok([502, 504].includes(res.statusCode), `502 ou 504 attendu, reçu ${res.statusCode}`);
    assertProblem(res, res.statusCode);
  });

  it('F5b - aucune réponse partielle présentée comme un succès', async () => {
    const { app } = await stack({ mode: 'disconnect' });
    const res = await app.inject({ method: 'GET', url: URL_AVAILABILITY });
    assert.notEqual(res.statusCode, 200);
  });
});
