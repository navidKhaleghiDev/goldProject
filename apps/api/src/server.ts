import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './database/pool.js';
import { expireOrders } from './modules/platform/platform.service.js';

const server = app.listen(env.API_PORT, () => {
  console.info(JSON.stringify({ level: 'info', message: 'API started', port: env.API_PORT }));
});
const expiryTimer = setInterval(() => {
  void expireOrders().catch(() =>
    console.error(JSON.stringify({ level: 'error', message: 'Order expiry worker failed' }))
  );
}, 30000);
expiryTimer.unref();

async function shutdown(signal: string) {
  clearInterval(expiryTimer);
  console.info(JSON.stringify({ level: 'info', message: 'Shutting down', signal }));
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
