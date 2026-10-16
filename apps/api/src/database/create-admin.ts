import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool } from './pool.js';
const input = z
  .object({
    ADMIN_PHONE: z.string().regex(/^09\d{9}$/),
    ADMIN_FULL_NAME: z.string().trim().min(2).max(100).default('مدیر'),
  })
  .parse(process.env);
try {
  const result = await pool.query(
    "INSERT INTO users(full_name,phone,password_hash,role,trusted) VALUES($1,$2,$3,'admin',true) ON CONFLICT(phone) DO NOTHING RETURNING id",
    [input.ADMIN_FULL_NAME, input.ADMIN_PHONE, `otp-only:${randomUUID()}`]
  );
  console.info(
    result.rowCount
      ? 'Administrator created'
      : 'Account already exists; no credentials or roles changed'
  );
} finally {
  await pool.end();
}
