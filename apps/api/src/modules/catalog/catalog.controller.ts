import type { RequestHandler } from 'express';
import { productListQuerySchema } from './catalog.schema.js';
import { getProducts } from './catalog.service.js';

export const listProductsController: RequestHandler = async (request, response) => {
  const query = productListQuerySchema.parse(request.query);
  const products = await getProducts(query);
  response.json({ success: true, data: products });
};
