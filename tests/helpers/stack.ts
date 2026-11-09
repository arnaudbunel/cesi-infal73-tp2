import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../apps/order-service/src/app.js';
import type { BuildAppOptions } from '../../apps/order-service/src/app.js';
import { buildStockApp } from '../../apps/stock-service/src/app.js';
import type { StockConfig } from '../../apps/stock-service/src/config.js';

export async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as AddressInfo).port;
}

export async function close(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

export interface Stack {
  app: FastifyInstance;
  stockPort: number;
  stop: () => Promise<void>;
}

/** Démarre un vrai serveur Stocks (port éphémère) et une application Commandes pointant dessus. */
export async function startStack(stock: Partial<StockConfig> = {}, orders: BuildAppOptions = {}): Promise<Stack> {
  const stockServer = buildStockApp(stock);
  const stockPort = await listen(stockServer);
  const app = buildApp({ stockBaseUrl: `http://127.0.0.1:${stockPort}`, ...orders });
  await app.ready();
  return {
    app,
    stockPort,
    stop: async () => {
      await app.close();
      await close(stockServer);
    },
  };
}

/** Serveur Stocks « sur mesure » pour fournir des corps arbitraires (tests de validation). */
export async function startCustomStock(status: number, body: string): Promise<{ port: number; stop: () => Promise<void> }> {
  const server = createServer((_req, res) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(body);
  });
  const port = await listen(server);
  return { port, stop: () => close(server) };
}

/** Port local sur lequel plus rien n'écoute (connexion refusée). */
export async function freePort(): Promise<number> {
  const server = createServer();
  const port = await listen(server);
  await close(server);
  return port;
}
