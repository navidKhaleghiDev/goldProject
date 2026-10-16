import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/app-error.js';
const rateSchema = z.object({
  buyTomanPerGram: z.number().int().positive().max(1e12),
  sellTomanPerGram: z.number().int().positive().max(1e12),
  updatedAt: z.string().datetime(),
  purity: z.string(),
});
export async function getRates() {
  const config = {
    lockSeconds: env.PRICE_LOCK_SECONDS,
    minWeightMg: env.MIN_TRADE_MG,
    maxWeightMg: env.MAX_TRADE_MG,
    serverTime: new Date().toISOString(),
  };
  if (env.TRADING_DEMO_ENABLED)
    return {
      ...config,
      buyTomanPerGram: env.DEMO_GOLD_PRICE_TOMAN,
      sellTomanPerGram: env.DEMO_GOLD_PRICE_TOMAN,
      updatedAt: new Date().toISOString(),
      purity: env.GOLD_PURITY,
      isDemo: true,
    };
  try {
    if (!env.GOLD_PRICE_API_URL) throw new Error();
    const response = await fetch(env.GOLD_PRICE_API_URL, {
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error();
    const rates = rateSchema.parse(await response.json());
    const age = Date.now() - Date.parse(rates.updatedAt);
    if (
      age > 30000 ||
      age < -5000 ||
      rates.purity !== env.GOLD_PURITY ||
      rates.sellTomanPerGram > rates.buyTomanPerGram
    )
      throw new Error();
    return { ...config, ...rates, isDemo: false };
  } catch {
    throw new AppError(
      503,
      'PRICE_UNAVAILABLE',
      'قیمت معتبر در دسترس نیست. کمی بعد دوباره تلاش کنید.'
    );
  }
}
