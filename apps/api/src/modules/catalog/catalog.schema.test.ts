import { describe, expect, it } from 'vitest';
import { productListQuerySchema } from './catalog.schema.js';

describe('productListQuerySchema', () => {
  it('applies safe catalog defaults', () => {
    expect(productListQuerySchema.parse({})).toEqual({
      sort: 'price_asc',
      page: 1,
      pageSize: 12,
    });
  });

  it('normalizes numeric pagination values', () => {
    expect(productListQuerySchema.parse({ page: '2', pageSize: '30' })).toMatchObject({
      page: 2,
      pageSize: 30,
    });
  });

  it('rejects unbounded page sizes', () => {
    expect(() => productListQuerySchema.parse({ pageSize: '31' })).toThrow();
  });

  it('rejects unknown availability values', () => {
    expect(() => productListQuerySchema.parse({ availability: 'all' })).toThrow();
  });
});
