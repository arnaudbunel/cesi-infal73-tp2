// Politique des champs inconnus : REFUS (400). `additionalProperties: false` + Ajv avec
// `removeAdditional: false` (voir app.ts). Cela inclut `status` à la création.
// Pas de coercion de types : "2" n'est pas un entier valide.

export interface CreateOrderBody {
  customerId: string;
  items: { productId: string; quantity: number }[];
}

export interface PatchOrderBody {
  status: 'CONFIRMED' | 'SHIPPED';
}

const NON_BLANK = '\\S'; // au moins un caractère non blanc

export const createOrderSchema = {
  headers: {
    type: 'object',
    required: ['idempotency-key'],
    properties: {
      'idempotency-key': { type: 'string', minLength: 1, maxLength: 255, pattern: NON_BLANK },
    },
  },
  body: {
    type: 'object',
    required: ['customerId', 'items'],
    additionalProperties: false,
    properties: {
      customerId: { type: 'string', minLength: 1, pattern: NON_BLANK },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['productId', 'quantity'],
          additionalProperties: false,
          properties: {
            productId: { type: 'string', minLength: 1, pattern: NON_BLANK },
            quantity: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
  },
} as const;

export const patchOrderSchema = {
  body: {
    type: 'object',
    required: ['status'],
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: ['CONFIRMED', 'SHIPPED'] },
    },
  },
} as const;
