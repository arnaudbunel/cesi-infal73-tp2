import type { FastifyPluginAsync } from 'fastify';
import { canTransition } from '../domain/order.js';
import type { Order, OrderStatus } from '../domain/order.js';
import { PROBLEM_TYPES, sendProblem } from '../problems.js';
import { createOrderSchema, patchOrderSchema } from '../schemas/orders.schema.js';
import type { CreateOrderBody, PatchOrderBody } from '../schemas/orders.schema.js';
import type { OrdersService } from '../services/orders.service.js';

interface Link {
  href: string;
  method: string;
}

/**
 * Représentation HTTP avec liens (format personnalisé, NON HAL).
 * Le lien `cancel` est dérivé de la même règle de transition que le contrôle serveur,
 * mais il n'est qu'une indication : seule la vérification à l'exécution fait autorité.
 */
function represent(order: Order) {
  const href = `/api/orders/${order.id}`;
  const _links: { self: Link; cancel?: Link } = { self: { href, method: 'GET' } };
  if (canTransition(order.status, 'CANCELLED')) {
    _links.cancel = { href: `${href}/cancellations`, method: 'POST' };
  }
  return { ...order, _links };
}

export function ordersRoutes(service: OrdersService): FastifyPluginAsync {
  return async (app) => {
    const notFound = (id: string) => `Order ${id} does not exist.`;
    const illegal = (from: OrderStatus, to: OrderStatus) =>
      `An order in status ${from} cannot move to ${to}.`;

    app.get('/api/orders', async () => (await service.list()).map(represent));

    app.get<{ Params: { id: string } }>('/api/orders/:id', async (request, reply) => {
      const order = await service.get(request.params.id);
      if (!order) {
        return sendProblem(request, reply, 404, PROBLEM_TYPES.orderNotFound, notFound(request.params.id));
      }
      return represent(order);
    });

    app.post<{ Body: CreateOrderBody; Headers: { 'idempotency-key': string } }>(
      '/api/orders',
      { schema: createOrderSchema },
      async (request, reply) => {
        const result = await service.create(request.headers['idempotency-key'], request.body);
        if (result.kind === 'key-conflict') {
          return sendProblem(
            request,
            reply,
            409,
            PROBLEM_TYPES.idempotencyConflict,
            'This Idempotency-Key was already used with a different payload.',
          );
        }
        if (result.replayed) reply.header('Idempotent-Replayed', 'true');
        return reply
          .code(201)
          .header('Location', `/api/orders/${result.order.id}`)
          .send(represent(result.order));
      },
    );

    app.patch<{ Params: { id: string }; Body: PatchOrderBody }>(
      '/api/orders/:id',
      { schema: patchOrderSchema },
      async (request, reply) => {
        const { id } = request.params;
        const result = await service.changeStatus(id, request.body.status);
        if (result.kind === 'not-found') {
          return sendProblem(request, reply, 404, PROBLEM_TYPES.orderNotFound, notFound(id));
        }
        if (result.kind === 'conflict') {
          return sendProblem(
            request, reply, 409, PROBLEM_TYPES.invalidTransition, illegal(result.from, request.body.status),
          );
        }
        return represent(result.order);
      },
    );

    app.post<{ Params: { id: string } }>('/api/orders/:id/cancellations', async (request, reply) => {
      const { id } = request.params;
      const result = await service.cancel(id);
      if (result.kind === 'not-found') {
        return sendProblem(request, reply, 404, PROBLEM_TYPES.orderNotFound, notFound(id));
      }
      if (result.kind === 'conflict') {
        return sendProblem(request, reply, 409, PROBLEM_TYPES.invalidTransition, illegal(result.from, 'CANCELLED'));
      }
      return represent(result.order);
    });
  };
}
