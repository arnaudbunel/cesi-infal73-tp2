import type { OrderServiceConfig } from '../config.js';

export interface StockInfo {
  productId: string;
  available: number;
}

/** Client HTTP du service Stocks (consultation uniquement). */
export class StockClient {
  constructor(private readonly config: OrderServiceConfig) {}

  async getStock(productId: string): Promise<StockInfo> {
    const response = await fetch(`${this.config.stockBaseUrl}/stock/${encodeURIComponent(productId)}`);
    return (await response.json()) as StockInfo;
  }
}
