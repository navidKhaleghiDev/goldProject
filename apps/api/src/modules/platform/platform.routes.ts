import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { AppError } from '../../shared/app-error.js';
import { administrator, authenticate, originGuard, type Actor } from '../auth/auth.js';
import {
  addBankAccount,
  assets,
  bankAccounts,
  createOrder,
  createPriceLock,
  createWithdrawal,
  decideOrder,
  decideWithdrawal,
  definePayments,
  ledgerHistory,
  orderDetail,
  orders,
  receiptAccess,
  reviewPayment,
  submitReceipt,
  upsertAsset,
  wallets,
  withdrawals,
} from './platform.service.js';

export const platformRouter = Router();
const id = z.string().uuid();
const actor = (response: express.Response) => response.locals.actor as Actor;
const send = (response: express.Response, data: unknown, status = 200) =>
  response.status(status).json({ success: true, data });
platformRouter.use(originGuard, authenticate);
platformRouter.use(
  rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false })
);
platformRouter.use((_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});
platformRouter.get('/gold-assets', async (_request, response) => send(response, await assets()));
platformRouter.post('/admin/gold-assets', administrator, async (request, response) =>
  send(
    response,
    await upsertAsset(actor(response), request.body, String(response.locals.requestId)),
    201
  )
);
platformRouter.post('/price-locks', async (request, response) =>
  send(response, await createPriceLock(actor(response), request.body), 201)
);
platformRouter.post('/orders', async (request, response) =>
  send(response, await createOrder(actor(response), request.body), 201)
);
platformRouter.get('/orders', async (_request, response) =>
  send(response, await orders(actor(response)))
);
platformRouter.get('/orders/:id', async (request, response) =>
  send(response, await orderDetail(actor(response), id.parse(request.params.id)))
);
platformRouter.post('/orders/:id/payments', async (request, response) =>
  send(
    response,
    await definePayments(actor(response), id.parse(request.params.id), request.body),
    201
  )
);
platformRouter.post(
  '/payments/:id/receipts',
  express.raw({ type: ['image/png', 'image/jpeg'], limit: '5mb' }),
  async (request, response) => {
    if (!Buffer.isBuffer(request.body))
      throw new AppError(422, 'INVALID_RECEIPT', 'Image receipt required');
    send(
      response,
      await submitReceipt(actor(response), id.parse(request.params.id), request.body),
      201
    );
  }
);
platformRouter.get('/receipts/:id', async (request, response) => {
  const receipt = await receiptAccess(actor(response), id.parse(request.params.id));
  response
    .type(receipt.mime)
    .set('Content-Disposition', 'inline; filename="receipt"')
    .sendFile(receipt.path);
});
platformRouter.get('/wallets', async (_request, response) =>
  send(response, await wallets(actor(response)))
);
platformRouter.get('/wallets/:id/transactions', async (request, response) =>
  send(response, await ledgerHistory(actor(response), id.parse(request.params.id)))
);
platformRouter.get('/bank-accounts', async (_request, response) =>
  send(response, await bankAccounts(actor(response)))
);
platformRouter.post('/bank-accounts', async (request, response) =>
  send(response, await addBankAccount(actor(response), request.body), 201)
);
platformRouter.get('/withdrawals', async (_request, response) =>
  send(response, await withdrawals(actor(response)))
);
platformRouter.post('/withdrawals', async (request, response) =>
  send(response, await createWithdrawal(actor(response), request.body), 201)
);
platformRouter.get('/admin/orders', administrator, async (_request, response) =>
  send(response, await orders(actor(response), true))
);
platformRouter.post('/admin/orders/:id/approve', administrator, async (request, response) =>
  send(
    response,
    await decideOrder(
      actor(response),
      id.parse(request.params.id),
      { decision: 'approve' },
      String(response.locals.requestId)
    )
  )
);
platformRouter.post('/admin/orders/:id/reject', administrator, async (request, response) =>
  send(
    response,
    await decideOrder(
      actor(response),
      id.parse(request.params.id),
      { decision: 'reject', ...request.body },
      String(response.locals.requestId)
    )
  )
);
platformRouter.post('/admin/payments/:id/approve', administrator, async (request, response) =>
  send(
    response,
    await reviewPayment(
      actor(response),
      id.parse(request.params.id),
      { decision: 'approve' },
      String(response.locals.requestId)
    )
  )
);
platformRouter.post('/admin/payments/:id/reject', administrator, async (request, response) =>
  send(
    response,
    await reviewPayment(
      actor(response),
      id.parse(request.params.id),
      { decision: 'reject', ...request.body },
      String(response.locals.requestId)
    )
  )
);
platformRouter.get('/admin/withdrawals', administrator, async (_request, response) =>
  send(response, await withdrawals(actor(response), true))
);
platformRouter.post('/admin/withdrawals/:id/approve', administrator, async (request, response) =>
  send(
    response,
    await decideWithdrawal(
      actor(response),
      id.parse(request.params.id),
      { decision: 'approve', ...request.body },
      String(response.locals.requestId)
    )
  )
);
platformRouter.post('/admin/withdrawals/:id/reject', administrator, async (request, response) =>
  send(
    response,
    await decideWithdrawal(
      actor(response),
      id.parse(request.params.id),
      { decision: 'reject', ...request.body },
      String(response.locals.requestId)
    )
  )
);
