import { describe, it, expect } from 'vitest';
import {
  milligrams,
  totalToman,
  quoteSchema,
  decisionSchema,
  receiptType,
} from './trading.rules.js';
describe('gold transaction input and arithmetic', () => {
  it('converts decimal grams without floating point loss', () => {
    expect(milligrams('0.001')).toBe(1);
    expect(milligrams('10.125')).toBe(10125);
    expect(milligrams('1.1')).toBe(1100);
  });
  it('rounds total upward at the toman boundary', () => {
    expect(totalToman(1, 7240001)).toBe(7241);
    expect(totalToman(10000, 7240000)).toBe(72400000);
  });
  it('rejects precision loss and client-supplied financial fields', () => {
    const base = {
      kind: 'buy',
      weightGrams: '1.000',
      idempotencyKey: '12b23254-7125-4fd2-82da-76ec5256e812',
    };
    expect(quoteSchema.safeParse({ ...base, weightGrams: '0.0001' }).success).toBe(false);
    expect(quoteSchema.safeParse({ ...base, totalToman: 1 }).success).toBe(false);
  });
  it('requires a useful rejection reason', () => {
    expect(decisionSchema.safeParse({ decision: 'reject', reason: '  ' }).success).toBe(false);
  });
  it('rejects executable or oversized receipt content', () => {
    expect(() => receiptType(Buffer.from('<script>alert(1)</script>'))).toThrow();
    expect(() => receiptType(Buffer.alloc(6 * 1024 * 1024))).toThrow();
  });
});
