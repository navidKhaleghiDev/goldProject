import { z } from 'zod';

export const productListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  availability: z.enum(['available', 'unavailable']).optional(),
  sort: z.enum(['price_asc', 'price_desc']).default('price_asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(30).default(12),
});
