import { Router } from 'express';
import { env } from '../../config/env.js';

export const marketRouter = Router();

marketRouter.get('/', (_request, response) => {
  response.json({
    success: true,
    data: {
      gold18TomanPerGram: env.DEMO_GOLD_PRICE_TOMAN,
      silver999TomanPerGram: env.DEMO_SILVER_PRICE_TOMAN,
      isDemo: true,
      updatedAt: new Date().toISOString(),
    },
  });
});
