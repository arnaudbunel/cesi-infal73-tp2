export interface OrderServiceConfig {
  /** URL de base du service Stocks. */
  stockBaseUrl: string;
  /** Budget de temps (ms) alloué à un appel vers Stocks. Valeur nominale du TP : 2000. */
  stockTimeoutMs: number;
}

export const DEFAULT_ORDER_CONFIG: OrderServiceConfig = {
  stockBaseUrl: 'http://127.0.0.1:3001',
  stockTimeoutMs: 2000,
};
