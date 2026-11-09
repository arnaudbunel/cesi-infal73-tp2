import { STATUS_CODES } from 'node:http';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** Registre des types de problèmes : URN stables, pas de promesse de documentation déréférençable. */
export const PROBLEM_TYPES = {
  validation: 'urn:infal73:problem:validation-error',
  orderNotFound: 'urn:infal73:problem:order-not-found',
  routeNotFound: 'urn:infal73:problem:route-not-found',
  invalidTransition: 'urn:infal73:problem:invalid-transition',
  idempotencyConflict: 'urn:infal73:problem:idempotency-key-conflict',
  internal: 'urn:infal73:problem:internal-error',
  http: 'urn:infal73:problem:http-error',
} as const;

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  [extension: string]: unknown;
}

export function sendProblem(
  request: FastifyRequest,
  reply: FastifyReply,
  status: number,
  type: string,
  detail: string,
  extensions: Record<string, unknown> = {},
): FastifyReply {
  const body: ProblemDetails = {
    type,
    title: STATUS_CODES[status] ?? 'Error',
    status, // toujours égal au code HTTP réellement émis
    detail,
    instance: request.url.split('?')[0] ?? request.url,
    ...extensions,
  };
  return reply.code(status).type('application/problem+json').send(body);
}
