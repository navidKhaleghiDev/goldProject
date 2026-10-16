import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { authRouter } from './modules/auth/auth.js';
import { tradingRouter } from './modules/trading/trading.routes.js';
import { platformRouter } from './modules/platform/platform.routes.js';
import { pool } from './database/pool.js';
import { allowedWebOrigins } from './config/env.js';
import { errorHandler } from './middlewares/error-handler.js';
import { requestContext } from './middlewares/request-context.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { marketRouter } from './modules/market/market.routes.js';

export const app = express();

app.disable('x-powered-by');
app.use(requestContext);
app.use(helmet());
app.use(cors({ origin: [...allowedWebOrigins], credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api/auth', authRouter);
app.use('/api/trading', tradingRouter);
app.use('/api/platform', platformRouter);

app.get('/health', (_request, response) => response.json({ status: 'ok' }));
app.get('/ready', async (_request, response) => {
  await pool.query('SELECT 1');
  response.json({ status: 'ready' });
});
app.use('/api/market-rates', marketRouter);
app.use('/api/products', catalogRouter);
app.use(errorHandler);
