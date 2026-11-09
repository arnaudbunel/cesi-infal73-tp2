export const STOCK_MODES = ['normal', 'status503', 'invalid_json', 'disconnect'] as const;
export type StockMode = (typeof STOCK_MODES)[number];

export interface StockConfig {
  host: string;
  port: number;
  latencyMs: number;
  mode: StockMode;
  available: number;
}

export const DEFAULT_STOCK_CONFIG: StockConfig = {
  host: '127.0.0.1',
  port: 3001,
  latencyMs: 50,
  mode: 'normal',
  available: 12,
};

const MAX_LATENCY_MS = 60_000;

function parseInteger(name: string, raw: string, min: number, max: number): number {
  if (!/^\d+$/.test(raw.trim())) throw new Error(`${name} must be an integer, got "${raw}"`);
  const value = Number(raw);
  if (value < min || value > max) throw new Error(`${name} must be between ${min} and ${max}, got ${value}`);
  return value;
}

/** Lit et valide les variables d'environnement. Lève une erreur explicite si une valeur est invalide. */
export function readStockConfig(env: NodeJS.ProcessEnv = process.env): StockConfig {
  const config: StockConfig = { ...DEFAULT_STOCK_CONFIG };
  if (env['STOCK_HOST']) config.host = env['STOCK_HOST'];
  if (env['STOCK_PORT']) config.port = parseInteger('STOCK_PORT', env['STOCK_PORT'], 0, 65535);
  if (env['STOCK_LATENCY_MS']) config.latencyMs = parseInteger('STOCK_LATENCY_MS', env['STOCK_LATENCY_MS'], 1, MAX_LATENCY_MS);
  if (env['STOCK_AVAILABLE']) config.available = parseInteger('STOCK_AVAILABLE', env['STOCK_AVAILABLE'], 0, 1_000_000);
  if (env['STOCK_MODE']) {
    const mode = env['STOCK_MODE'];
    if (!(STOCK_MODES as readonly string[]).includes(mode)) {
      throw new Error(`STOCK_MODE must be one of ${STOCK_MODES.join(', ')}, got "${mode}"`);
    }
    config.mode = mode as StockMode;
  }
  return config;
}
