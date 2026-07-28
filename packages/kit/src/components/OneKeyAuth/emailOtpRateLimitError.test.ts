import { EMAIL_OTP_COUNTDOWN_SECONDS } from '@onekeyhq/shared/src/consts/authConsts';

import {
  createEmailOtpRateLimitError,
  getEmailOtpRateLimitRetryAfterSeconds,
  parseEmailOtpRateLimitRetryAfterSeconds,
} from './emailOtpRateLimitError';

describe('emailOtpRateLimitError', () => {
  test('extracts the retry delay from the Supabase message', () => {
    expect(
      parseEmailOtpRateLimitRetryAfterSeconds({
        code: 'over_email_send_rate_limit',
        message:
          'For security purposes, you can only request this after 33 seconds.',
      }),
    ).toBe(33);
  });

  test('supports legacy Supabase errors without an error code', () => {
    expect(
      parseEmailOtpRateLimitRetryAfterSeconds({
        message:
          'For security purposes, you can only request this after 12 seconds.',
      }),
    ).toBe(12);
  });

  test('uses the client countdown when Supabase omits a parseable delay', () => {
    expect(
      parseEmailOtpRateLimitRetryAfterSeconds({
        code: 'over_email_send_rate_limit',
        message: 'Email requests are temporarily limited.',
      }),
    ).toBe(EMAIL_OTP_COUNTDOWN_SECONDS);
  });

  test('does not classify unrelated errors as an email OTP cooldown', () => {
    expect(
      parseEmailOtpRateLimitRetryAfterSeconds({
        code: 'over_request_rate_limit',
        message: 'Too many requests.',
      }),
    ).toBeUndefined();
  });

  test('reads the structured delay after OneKey error serialization', () => {
    const error = createEmailOtpRateLimitError({
      message: 'Please retry after 33 seconds.',
      retryAfterSeconds: 33,
    });

    expect(getEmailOtpRateLimitRetryAfterSeconds(error.serialize())).toBe(33);
  });
});
