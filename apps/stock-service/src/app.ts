import { createServer } from 'node:http';
import type { Server, ServerResponse } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
import { DEFAULT_STOCK_CONFIG } from './config.js';
import type { StockConfig } from './config.js';

/**
 * Simulateur Stocks. Aucune route de contrôle : le comportement est fixé à la construction
 * (variables d'environnement au démarrage, ou `config` injectée localement par les tests).
 * Outil pédagogique : ne pas déployer.
 */
export function buildStockApp(partial: Partial<StockConfig> = {}): Server {
  const config: StockConfig = { ...DEFAULT_STOCK_CONFIG, ...partial };

  return createServer((req, res) => {
    void handle(req.method ?? 'GET', (req.url ?? '/').split('?')[0] ?? '/', res, config).catch(() => {
      res.socket?.destroy();
    });
  });
}

async function handle(method: string, path: string, res: ServerResponse, config: StockConfig): Promise<void> {
  const match = /^\/stock\/([^/]+)$/.exec(path);
  if (method !== 'GET' || !match) {
    return json(res, 404, { error: 'not found' });
  }
  const productId = decodeURIComponent(match[1] ?? '');

  if (config.latencyMs > 0) await sleep(config.latencyMs);
  if (res.destroyed) return; // le client a abandonné pendant la latence

  switch (config.mode) {
    case 'normal':
      // Seul P12 est connu du simulateur.
      return productId === 'P12'
        ? json(res, 200, { productId, available: config.available })
        : json(res, 404, { error: 'unknown product' });
    case 'status503':
      return json(res, 503, { error: 'service unavailable' });
    case 'invalid_json': {
      const body = '{"productId":"P12","available":';
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
      res.end(body);
      return;
    }
    case 'disconnect': {
      // En-têtes annonçant 64 octets, 22 seulement envoyés, puis fermeture forcée de la connexion.
      const partialBody = '{"productId":"P12","a';
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': 64 });
      res.write(partialBody, () => res.socket?.destroy());
      return;
    }
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}
