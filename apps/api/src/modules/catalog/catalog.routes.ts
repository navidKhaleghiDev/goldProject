import { Router } from 'express';
import { listProductsController } from './catalog.controller.js';

export const catalogRouter = Router();
catalogRouter.get('/', listProductsController);
