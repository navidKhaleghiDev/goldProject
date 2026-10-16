import { afterEach, describe, it, expect, vi } from 'vitest';
const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://unused/test',
  SESSION_SECRET: 'test-secret-at-least-32-characters-long',
  DEMO_OTP_ENABLED: 'false',
  WHATSAPP_PHONE: '989120000000',
  TELEGRAM_USERNAME: 'test_gold',
  DEMO_GOLD_PRICE_TOMAN: '7240000',
  DEMO_SILVER_PRICE_TOMAN: '115000',
  TRADING_DEMO_ENABLED: 'false',
  GOLD_PRICE_API_URL: 'https://provider.invalid/rates',
};
async function load() {
  vi.resetModules();
  for (const [key, value] of Object.entries(base)) vi.stubEnv(key, value);
  return import('./trading.rates.js');
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('authoritative price source', () => {
  it('returns separate provider buy and sell prices', async () => {
    const { getRates } = await load();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              buyTomanPerGram: 100,
              sellTomanPerGram: 90,
              purity: '18k',
              updatedAt: new Date().toISOString(),
            })
          )
        )
    );
    expect(await getRates()).toMatchObject({
      buyTomanPerGram: 100,
      sellTomanPerGram: 90,
      isDemo: false,
    });
  });
  it('fails closed on stale prices', async () => {
    const { getRates } = await load();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              buyTomanPerGram: 100,
              sellTomanPerGram: 90,
              purity: '18k',
              updatedAt: new Date(Date.now() - 60000).toISOString(),
            })
          )
        )
    );
    await expect(getRates()).rejects.toMatchObject({ code: 'PRICE_UNAVAILABLE' });
  });
  it('never substitutes a demo price when the provider fails', async () => {
    const { getRates } = await load();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(getRates()).rejects.toMatchObject({ code: 'PRICE_UNAVAILABLE' });
  });
  it('rejects the wrong purity', async () => {
    const { getRates } = await load();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              buyTomanPerGram: 100,
              sellTomanPerGram: 90,
              purity: '24k',
              updatedAt: new Date().toISOString(),
            })
          )
        )
    );
    await expect(getRates()).rejects.toMatchObject({ code: 'PRICE_UNAVAILABLE' });
  });
});
