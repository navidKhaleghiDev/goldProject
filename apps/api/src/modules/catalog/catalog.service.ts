import { listProducts } from './catalog.repository.js';
import type { z } from 'zod';
import type { productListQuerySchema } from './catalog.schema.js';

export function getProducts(query: z.infer<typeof productListQuerySchema>) {
  return listProducts(query);
}
