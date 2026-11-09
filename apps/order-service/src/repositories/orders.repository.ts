import { canTransition } from '../domain/order.js';
import type { NewOrderInput, Order, OrderStatus } from '../domain/order.js';

function seedOrder(id: string, status: OrderStatus, customerId: string, productId: string, quantity = 1): Order {
  const date = '2026-01-01T09:00:00.000Z';
  return { id, customerId, items: [{ productId, quantity }], status, createdAt: date, updatedAt: date };
}

export type TransitionOutcome =
  | { kind: 'ok'; order: Order }
  | { kind: 'not-found' }
  | { kind: 'illegal'; from: OrderStatus };

/**
 * Stockage en mémoire : chaque instance repart des mêmes données initiales.
 * L'interface est asynchrone pour rester remplaçable par une vraie base (TP suivants).
 */
export class OrdersRepository {
  private readonly orders = new Map<string, Order>();
  private sequence = 105;

  constructor() {
    for (const order of [
      seedOrder('ORD-101', 'CREATED', 'C100', 'P1'),
      seedOrder('ORD-102', 'CONFIRMED', 'C101', 'P12', 2),
      seedOrder('ORD-103', 'SHIPPED', 'C102', 'P3'),
      seedOrder('ORD-104', 'CANCELLED', 'C103', 'P4'),
    ]) {
      this.orders.set(order.id, order);
    }
  }

  async findAll(): Promise<Order[]> {
    return [...this.orders.values()].map((o) => structuredClone(o));
  }

  async findById(id: string): Promise<Order | null> {
    const order = this.orders.get(id);
    return order ? structuredClone(order) : null;
  }

  /** Attribution d'identifiant et insertion en une seule étape (équivalent d'un INSERT ... RETURNING). */
  async create(input: NewOrderInput): Promise<Order> {
    const id = `ORD-${this.sequence++}`;
    const now = new Date().toISOString();
    const order: Order = {
      id,
      customerId: input.customerId,
      items: structuredClone(input.items),
      status: 'CREATED',
      createdAt: now,
      updatedAt: now,
    };
    this.orders.set(id, order);
    return structuredClone(order);
  }

  /**
   * Lecture + contrôle de la transition + écriture SANS point de suspension entre les trois :
   * en mono-thread, cette section est atomique. C'est l'équivalent en mémoire de
   * `UPDATE orders SET status = $to WHERE id = $id AND status IN (...)`.
   * Deux demandes concurrentes ne peuvent donc pas valider la même transition.
   */
  async transition(id: string, target: OrderStatus): Promise<TransitionOutcome> {
    const order = this.orders.get(id);
    if (!order) return { kind: 'not-found' };
    if (!canTransition(order.status, target)) return { kind: 'illegal', from: order.status };
    order.status = target;
    order.updatedAt = new Date().toISOString();
    return { kind: 'ok', order: structuredClone(order) };
  }
}
