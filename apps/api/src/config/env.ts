import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
    WEB_ORIGINS: z.string().default('').transform((value) =>
      value.split(',').map((origin) => origin.trim()).filter(Boolean)
    ).pipe(z.array(z.string().url())),
    DATABASE_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
    BANK_ACCOUNT_ENCRYPTION_KEY: z.string().min(32).optional(),
    DEMO_OTP_ENABLED: booleanString.default(true),
    LEGACY_PASSWORD_AUTH_ENABLED: booleanString.default(false),
    DEMO_OTP_CODE: z
      .string()
      .regex(/^\d{6}$/)
      .default('123456'),
    WHATSAPP_PHONE: z.string().regex(/^\d{10,15}$/),
    TELEGRAM_USERNAME: z.string().regex(/^[A-Za-z0-9_]{5,32}$/),
    DEMO_GOLD_PRICE_TOMAN: z.coerce.number().int().positive(),
    DEMO_SILVER_PRICE_TOMAN: z.coerce.number().int().positive(),
    TRADING_DEMO_ENABLED: booleanString.default(false),
    GOLD_PRICE_API_URL: z.string().url().optional(),
    GOLD_PURITY: z.string().min(1).default('18k'),
    PRICE_LOCK_SECONDS: z.coerce.number().int().min(15).max(600).default(60),
    PAYMENT_WINDOW_SECONDS: z.coerce.number().int().min(60).max(86400).default(3600),
    RECEIPT_CORRECTION_SECONDS: z.coerce.number().int().min(30).max(3600).default(120),
    MIN_TRADE_MG: z.coerce.number().int().min(1).default(1),
    MAX_TRADE_MG: z.coerce.number().int().max(1000000).positive().default(100000),
    PAYMENT_INSTRUCTIONS: z.string().max(2000).default(''),
    RECEIPT_DIRECTORY: z.string().default('./private-receipts'),
  })
  .superRefine((env, context) => {
    if (
      env.MIN_TRADE_MG > env.MAX_TRADE_MG ||
      (env.NODE_ENV === 'production' && env.TRADING_DEMO_ENABLED)
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Invalid trading configuration: demo is forbidden in production and limits must be ordered',
      });
    }
    if (env.NODE_ENV === 'production' && env.DEMO_OTP_ENABLED) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DEMO_OTP_ENABLED'],
        message: 'Demo OTP must be disabled in production',
      });
    }
    if (env.NODE_ENV === 'production' && env.LEGACY_PASSWORD_AUTH_ENABLED) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['LEGACY_PASSWORD_AUTH_ENABLED'],
        message: 'Password login is disabled in production',
      });
    }
    if (env.NODE_ENV === 'production' && !env.BANK_ACCOUNT_ENCRYPTION_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BANK_ACCOUNT_ENCRYPTION_KEY'],
        message: 'Bank account encryption key is required in production',
      });
    }
  });

export const env = envSchema.parse(process.env);
export const allowedWebOrigins = new Set([env.WEB_ORIGIN, ...env.WEB_ORIGINS]);
