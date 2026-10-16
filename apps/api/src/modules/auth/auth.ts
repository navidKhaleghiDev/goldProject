import { Router, type RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { pool } from '../../database/pool.js';
import { allowedWebOrigins, env } from '../../config/env.js';
import { AppError } from '../../shared/app-error.js';
import { smsProvider } from './sms-provider.js';

export interface Actor {
  id: string;
  fullName: string;
  phone: string;
  role: 'customer' | 'admin';
  trusted: boolean;
}
const credentials = z.object({
  phone: z.string().regex(/^09\d{9}$/),
  password: z
    .string()
    .min(8)
    .max(72)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password exceeds 72 bytes'),
});
const registration = credentials.extend({ fullName: z.string().trim().min(2).max(100) }).strict();
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};
const otpPhone = z.string().regex(/^09\d{9}$/);
const otpDigest = (phone: string, code: string) =>
  createHash('sha256').update(`${env.SESSION_SECRET}:${phone}:${code}`).digest('hex');
function issueSession(response: import('express').Response, user: Actor) {
  const token = jwt.sign({}, env.SESSION_SECRET, {
    subject: user.id,
    expiresIn: '8h',
    algorithm: 'HS256',
    issuer: 'sheri-gold',
    audience: 'gold-web',
  });
  response.cookie('gold_session', token, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });
  response.json({
    success: true,
    data: {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      trusted: user.trusted,
    },
  });
}
export const originGuard: RequestHandler = (request, _response, next) => {
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
    !allowedWebOrigins.has(request.get('origin') ?? '')
  ) {
    next(new AppError(403, 'ORIGIN_DENIED', 'مبدأ درخواست معتبر نیست.'));
    return;
  }
  next();
};
export const authenticate: RequestHandler = async (request, response, next) => {
  let id: string;
  try {
    const token: unknown = request.cookies?.gold_session;
    if (typeof token !== 'string') throw new Error();
    const payload = jwt.verify(token, env.SESSION_SECRET, {
      algorithms: ['HS256'],
      issuer: 'sheri-gold',
      audience: 'gold-web',
    });
    if (typeof payload === 'string' || !payload.sub) throw new Error();
    id = z.string().uuid().parse(payload.sub);
  } catch {
    throw new AppError(401, 'UNAUTHENTICATED', 'برای ادامه وارد حساب شوید.');
  }
  const result = await pool.query<Actor>(
    'SELECT id, full_name AS "fullName", phone, role, trusted FROM users WHERE id=$1',
    [id]
  );
  if (!result.rows[0]) throw new AppError(401, 'UNAUTHENTICATED', 'حساب پیدا نشد.');
  response.locals.actor = result.rows[0];
  next();
};
export const administrator: RequestHandler = (_request, response, next) => {
  if ((response.locals.actor as Actor).role !== 'admin')
    throw new AppError(403, 'FORBIDDEN', 'دسترسی مدیر لازم است.');
  next();
};
export const authRouter = Router();
authRouter.use((_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});
authRouter.use(originGuard);
authRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  })
);
authRouter.post('/otp/request', async (request, response) => {
  const { phone } = z.object({ phone: otpPhone }).strict().parse(request.body);
  const provider = smsProvider();
  const code = env.DEMO_OTP_CODE;
  const challenge = await pool.query(
    `INSERT INTO otp_challenges(phone,code_hash,attempts,expires_at,requested_at) VALUES($1,$2,0,now()+interval '5 minutes',now())
     ON CONFLICT(phone) DO UPDATE SET code_hash=$2,attempts=0,expires_at=now()+interval '5 minutes',requested_at=now()
     WHERE otp_challenges.requested_at < now()-interval '60 seconds' RETURNING phone`,
    [phone, otpDigest(phone, code)]
  );
  if (!challenge.rowCount)
    throw new AppError(429, 'OTP_COOLDOWN', 'Please wait before requesting another code');
  await provider.sendOtp(phone, code);
  response.json({ success: true, data: { requested: true, expiresInSeconds: 300 } });
});
authRouter.post('/otp/verify', async (request, response) => {
  const input = z
    .object({
      phone: otpPhone,
      code: z.string().regex(/^\d{6}$/),
      fullName: z.string().trim().min(2).max(100).optional(),
    })
    .strict()
    .parse(request.body);
  smsProvider();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const challenge = await client.query<{ code_hash: string; attempts: number; expires_at: Date }>(
      'SELECT code_hash,attempts,expires_at FROM otp_challenges WHERE phone=$1 FOR UPDATE',
      [input.phone]
    );
    const row = challenge.rows[0];
    if (
      !row ||
      row.expires_at.getTime() <= Date.now() ||
      row.attempts >= 5 ||
      row.code_hash !== otpDigest(input.phone, input.code)
    ) {
      if (row)
        await client.query('UPDATE otp_challenges SET attempts=attempts+1 WHERE phone=$1', [
          input.phone,
        ]);
      await client.query('COMMIT');
      throw new AppError(401, 'INVALID_OTP', 'Invalid or expired code');
    }
    let user = (
      await client.query<Actor>(
        'SELECT id,full_name AS "fullName",phone,role,trusted FROM users WHERE phone=$1',
        [input.phone]
      )
    ).rows[0];
    if (!user) {
      if (!input.fullName)
        throw new AppError(422, 'NAME_REQUIRED', 'Full name is required for a new account');
      user = (
        await client.query<Actor>(
          'INSERT INTO users(full_name,phone,password_hash) VALUES($1,$2,$3) RETURNING id,full_name AS "fullName",phone,role,trusted',
          [input.fullName, input.phone, `otp-only:${randomUUID()}`]
        )
      ).rows[0]!;
    }
    await client.query('DELETE FROM otp_challenges WHERE phone=$1', [input.phone]);
    await client.query('COMMIT');
    issueSession(response, user);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
});
authRouter.post('/register', async (request, response) => {
  if (!env.LEGACY_PASSWORD_AUTH_ENABLED)
    throw new AppError(410, 'PASSWORD_AUTH_DISABLED', 'Use OTP sign in');
  const input = registration.parse(request.body);
  const hash = await bcrypt.hash(input.password, 12);
  const result = await pool.query(
    'INSERT INTO users(full_name,phone,password_hash) VALUES($1,$2,$3) ON CONFLICT(phone) DO NOTHING RETURNING id',
    [input.fullName, input.phone, hash]
  );
  if (!result.rowCount)
    throw new AppError(
      409,
      'REGISTRATION_FAILED',
      'ثبت‌نام انجام نشد. در صورت داشتن حساب وارد شوید.'
    );
  response.status(201).json({ success: true, data: { registered: true } });
});
authRouter.post('/login', async (request, response) => {
  if (!env.LEGACY_PASSWORD_AUTH_ENABLED)
    throw new AppError(410, 'PASSWORD_AUTH_DISABLED', 'Use OTP sign in');
  const input = credentials.strict().parse(request.body);
  const result = await pool.query<Actor & { password_hash: string }>(
    'SELECT id, full_name AS "fullName",phone,role,trusted,password_hash FROM users WHERE phone=$1',
    [input.phone]
  );
  const user = result.rows[0];
  const valid = await bcrypt.compare(
    input.password,
    user?.password_hash ?? '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW'
  );
  if (!user || !valid)
    throw new AppError(401, 'INVALID_CREDENTIALS', 'شماره یا رمز عبور نادرست است.');
  issueSession(response, user);
});
authRouter.get('/me', authenticate, (_request, response) =>
  response.json({ success: true, data: response.locals.actor })
);
authRouter.post('/logout', (_request, response) => {
  response.clearCookie('gold_session', cookieOptions);
  response.json({ success: true, data: null });
});
