import Fastify from 'fastify';
import type { FastifyError, FastifyInstance } from 'fastify';
import { DEFAULT_ORDER_CONFIG } from './config.js';
import type { OrderServiceConfig } from './config.js';
import type { LabHooks } from './lab.js';
import { PROBLEM_TYPES, sendProblem } from './problems.js';
import { OrdersRepository } from './repositories/orders.repository.js';
import { availabilityRoutes } from './routes/availability.routes.js';
import { diagnosticsRoutes } from './routes/diagnostics.routes.js';
import { ordersRoutes } from './routes/orders.routes.js';
import { OrdersService } from './services/orders.service.js';
import { StockClient } from './services/stock.client.js';

export interface BuildAppOptions extends Partial<OrderServiceConfig> {
  logger?: boolean;
  /** Mode laboratoire : active les points d'injection de panne. Interdit en production. */
  labMode?: boolean;
  lab?: LabHooks;
}

/** Chaque appel crée une application neuve, avec des données initiales neuves. */
export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const { logger = false, labMode = false, lab } = options;
  const config: OrderServiceConfig = {
    stockBaseUrl: options.stockBaseUrl ?? DEFAULT_ORDER_CONFIG.stockBaseUrl,
    stockTimeoutMs: options.stockTimeoutMs ?? DEFAULT_ORDER_CONFIG.stockTimeoutMs,
  };

  if (labMode && process.env['NODE_ENV'] === 'production') {
    throw new Error('labMode is forbidden when NODE_ENV=production');
  }
  if (lab && !labMode) {
    throw new Error('Lab hooks require buildApp({ labMode: true })');
  }

  const app = Fastify({
    logger,
    // Validation stricte : champs inconnus refusés (et non supprimés), pas de coercion de types.
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false, allErrors: true } },
  });
  const service = new OrdersService(new OrdersRepository(), labMode ? lab : undefined);

  if (labMode && lab?.onRequest) {
    const onRequest = lab.onRequest;
    app.addHook('onRequest', async (request) => {
      await onRequest({ method: request.method, url: request.url, headers: { ...request.headers } });
    });
  }

  app.setNotFoundHandler((request, reply) =>
    sendProblem(request, reply, 404, PROBLEM_TYPES.routeNotFound, `No route matches ${request.method} ${request.url.split('?')[0]}.`),
  );

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      const context = error.validationContext ?? 'request';
      const errors = error.validation.map((v) => ({
        field: `${context}${v.instancePath.replaceAll('/', '.')}`,
        message: v.message ?? 'invalid',
      }));
      return sendProblem(request, reply, 400, PROBLEM_TYPES.validation, 'The request does not satisfy the API contract.', { errors });
    }
    const status = error.statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      // Erreurs 4xx levées par Fastify lui-même (JSON invalide, media type...) : messages sûrs.
      return sendProblem(request, reply, status, PROBLEM_TYPES.http, error.message);
    }
    // Erreur inattendue : détail uniquement dans les logs, jamais dans la réponse.
    request.log.error({ err: error }, 'unhandled error');
    return sendProblem(request, reply, 500, PROBLEM_TYPES.internal, 'An unexpected error occurred.');
  });

  void app.register(ordersRoutes(service));
  void app.register(availabilityRoutes(service, new StockClient(config)));
  // Routes de laboratoire : jamais exposées en production.
  if (process.env['NODE_ENV'] !== 'production') {
    void app.register(diagnosticsRoutes);
  }
  return app;
}
