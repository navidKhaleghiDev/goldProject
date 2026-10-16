import { z } from 'zod';
import { AppError } from '../../shared/app-error.js';

export const quoteSchema = z
  .object({
    kind: z.enum(['buy', 'sell']),
    weightGrams: z.string().regex(/^\d{1,3}(\.\d{1,3})?$/),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export const decisionSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('reject'), reason: z.string().trim().min(3).max(1000) }).strict(),
  z
    .object({
      decision: z.literal('approve'),
      acknowledgement: z.string().trim().min(3).max(1000).optional(),
    })
    .strict(),
]);
export function milligrams(value: string) {
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
}
export function totalToman(weightMg: number, rate: number) {
  const value = (BigInt(weightMg) * BigInt(rate) + 999n) / 1000n;
  if (value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new AppError(422, 'AMOUNT_LIMIT', 'مبلغ بیش از حد مجاز است.');
  return Number(value);
}
export function receiptType(buffer: Buffer): 'image/png' | 'image/jpeg' {
  const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg =
    buffer[0] === 255 &&
    buffer[1] === 216 &&
    buffer[2] === 255 &&
    buffer.at(-2) === 255 &&
    buffer.at(-1) === 217;
  if (buffer.length < 32 || buffer.length > 5 * 1024 * 1024 || (!png && !jpeg))
    throw new AppError(
      422,
      'INVALID_RECEIPT',
      'رسید باید تصویر PNG یا JPEG و حداکثر ۵ مگابایت باشد.'
    );
  let width = 0;
  let height = 0;
  if (png) {
    if (
      buffer.toString('ascii', 12, 16) === 'IHDR' &&
      buffer.readUInt32BE(8) === 13 &&
      buffer.toString('ascii', buffer.length - 8, buffer.length - 4) === 'IEND'
    ) {
      width = buffer.readUInt32BE(16);
      height = buffer.readUInt32BE(20);
    }
  } else {
    // Find a supported JPEG start-of-frame marker without decoding untrusted pixels.
    let offset = 2;
    while (offset + 4 <= buffer.length) {
      if (buffer[offset] !== 255) break;
      const marker = buffer[offset + 1];
      if (marker === 255) {
        offset++;
        continue;
      }
      if (marker === 218 || marker === 217) break;
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > buffer.length) break;
      if ([192, 193, 194].includes(marker ?? 0) && length >= 8) {
        height = buffer.readUInt16BE(offset + 5);
        width = buffer.readUInt16BE(offset + 7);
        break;
      }
      offset += 2 + length;
    }
  }
  if (!width || !height || width * height > 40000000)
    throw new AppError(422, 'INVALID_RECEIPT', 'ساختار یا ابعاد تصویر معتبر نیست.');
  return png ? 'image/png' : 'image/jpeg';
}
