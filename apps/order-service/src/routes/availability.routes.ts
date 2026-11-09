import type { FastifyPluginAsync } from 'fastify';
import { PROBLEM_TYPES, sendProblem } from '../problems.js';
import type { OrdersService } from '../services/orders.service.js';
import type { StockClient } from '../services/stock.client.js';

/**
 * Consultation de disponibilité (lecture seule : ni commande ni stock ne sont modifiés).
 * Règle pédagogique : l'article de référence est la PREMIÈRE ligne de la commande.
 */
export function availabilityRoutes(service: OrdersService, stock: StockClient): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Params: { id: string } }>('/api/orders/:id/availability', async (request, reply) => {
      const order = await service.get(request.params.id);
      if (!order) {
        return sendProblem(request, reply, 404, PROBLEM_TYPES.orderNotFound, `Order ${request.params.id} does not exist.`);
      }
      const item = order.items[0];
      if (!item) {
        return sendProblem(request, reply, 404, PROBLEM_TYPES.orderNotFound, `Order ${order.id} has no item.`);
      }
      const info = await stock.getStock(item.productId);
      return {
        orderId: order.id,
        productId: item.productId,
        requestedQuantity: item.quantity,
        available: info.available,
        canFulfill: info.available >= item.quantity,
      };
    });
  };
}
