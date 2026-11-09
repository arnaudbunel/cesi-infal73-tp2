import type { FastifyPluginAsync } from 'fastify';
import { setTimeout as sleep } from 'node:timers/promises';

const DURATION_MS = 300;

/**
 * Routes de laboratoire (pédagogiques). Jamais enregistrées quand NODE_ENV=production.
 * `blocking` occupe volontairement le thread JavaScript principal.
 */
export const diagnosticsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/diagnostics/blocking', async () => {
    const end = performance.now() + DURATION_MS;
    while (performance.now() < end) {
      // attente active
    }
    return { mode: 'blocking' };
  });

  app.get('/api/diagnostics/nonblocking', async () => {
    await sleep(DURATION_MS);
    return { mode: 'nonblocking' };
  });
};
