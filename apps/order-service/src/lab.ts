import type { Order } from './domain/order.js';

/**
 * Points d'injection de panne, utilisables UNIQUEMENT si buildApp({ labMode: true }).
 * Ils servent aux tests et aux expérimentations de laboratoire.
 */
export interface LabHooks {
  /** Appelé au début de chaque requête ; lever une exception simule une panne inattendue. */
  onRequest?: (request: { method: string; url: string; headers: Record<string, unknown> }) => void | Promise<void>;
  /**
   * Point de synchronisation de la création, juste après la consultation de la clé d'idempotence.
   * - 'reserved' : la clé vient d'être réservée par cette requête (avant tout travail asynchrone) ;
   *   lever ici simule un échec AVANT effet métier.
   * - 'known'    : la clé existait déjà (rejeu ou requête concurrente) ; la requête va attendre/rejouer.
   */
  afterIdempotencyCheck?: (key: string, outcome: 'reserved' | 'known') => void | Promise<void>;
  /** Appelé après l'écriture de la commande ET l'enregistrement du résultat d'idempotence, avant la réponse. */
  afterMutation?: (order: Order) => void | Promise<void>;
}
