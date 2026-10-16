import { env } from '../../config/env.js';
import { AppError } from '../../shared/app-error.js';

export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}

class MockSmsProvider implements SmsProvider {
  async sendOtp(_phone: string, _code: string) {
    // The configured development code is delivered out of band to the tester.
    // Never put an OTP in an API response or technical log.
  }
}

export function smsProvider(): SmsProvider {
  if (env.DEMO_OTP_ENABLED && env.NODE_ENV !== 'production') return new MockSmsProvider();
  throw new AppError(503, 'SMS_UNAVAILABLE', 'SMS provider is not configured');
}
