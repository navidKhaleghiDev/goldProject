import { pool } from '../../database/pool.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/app-error.js';

export interface PricingProvider {
  getQuote(input: {
    side: 'buy' | 'sell';
    goldAssetId: string;
    quantityMg: bigint;
    unitId: string;
  }): Promise<{ rateTomanPerGram: bigint; source: string }>;
}

class MockPricingProvider implements PricingProvider {
  async getQuote(input: { side: 'buy' | 'sell'; goldAssetId: string }) {
    const price = await pool.query<{ buy_toman_per_gram: string; sell_toman_per_gram: string }>(
      'SELECT p.buy_toman_per_gram::text,p.sell_toman_per_gram::text FROM gold_assets a JOIN gold_mock_prices p ON p.asset_id=a.id WHERE a.id=$1 AND a.active',
      [input.goldAssetId]
    );
    if (!price.rows[0]) throw new AppError(503, 'PRICE_UNAVAILABLE', 'Price not available');
    return {
      rateTomanPerGram: BigInt(
        input.side === 'buy' ? price.rows[0].buy_toman_per_gram : price.rows[0].sell_toman_per_gram
      ),
      source: 'mock',
    };
  }
}

export function pricingProvider(): PricingProvider {
  if (env.TRADING_DEMO_ENABLED) return new MockPricingProvider();
  throw new AppError(503, 'PRICE_UNAVAILABLE', 'A live pricing provider is not configured');
}
