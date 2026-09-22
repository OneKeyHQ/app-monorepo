import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { createIntl } from 'react-intl';

import {
  getSanitizedAuthErrorText,
  logOneKeyIdLoginFailureReason,
} from '@onekeyhq/kit/src/views/Prime/components/oneKeyIdLoginToastUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  getEmailOtpRequestErrorMessage,
  isEmailOtpSendKnownFailure,
} from '../emailOtpErrorUtils';

import { requestEmailOtp } from './requestEmailOtp';

jest.mock(
  '@onekeyhq/kit/src/views/Prime/components/oneKeyIdLoginToastUtils',
  () => ({
    getSanitizedAuthErrorText: jest.fn(() => 'sanitized error'),
    logOneKeyIdLoginFailureReason: jest.fn(),
  }),
);

const messages: Record<string, string> = {
  [ETranslations.global_unknown_error_retry_message]: 'Please try again.',
  [ETranslations.email_verification_rate_limit]: 'Retry after {rest} seconds.',
  [ETranslations.auth_captcha_incomplete__msg]:
    'Security verification was not completed. Please try again.',
};
const intl = createIntl({ locale: 'en', messages });

describe('Email OTP request security boundary', () => {
  test('localizes the CAPTCHA toast while retaining the original SDK error for diagnostics', async () => {
    const message =
      'captcha protection: request disallowed (no captcha_token found)';
    const sdkError = new AuthApiError(message, 400, 'captcha_failed');
    const signInWithOtp = jest.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: sdkError,
    });
    const request = requestEmailOtp({
      client: { auth: { signInWithOtp } },
      email: 'test@example.com',
      intl,
    });
    await expect(request).rejects.toBeInstanceOf(OneKeyLocalError);
    await expect(request).rejects.toThrow(
      messages[ETranslations.auth_captcha_incomplete__msg],
    );
    const toastMessage = await request.catch((error: unknown) =>
      getEmailOtpRequestErrorMessage({ error, intl }),
    );
    expect(toastMessage).toBe(
      messages[ETranslations.auth_captcha_incomplete__msg],
    );
    expect(getSanitizedAuthErrorText).toHaveBeenCalledWith(sdkError);
    expect(sdkError.message).toBe(message);
    expect(logOneKeyIdLoginFailureReason).toHaveBeenCalledWith(
      'OneKey ID email verification code request failed: sanitized error',
      expect.any(OneKeyLocalError),
    );
    await expect(request).rejects.toMatchObject({
      data: { isEmailOtpSendFailure: true },
    });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
      options: { shouldCreateUser: true },
    });
  });

  test.each([
    {
      error: new AuthApiError('CAPTCHA rejected', 400, 'captcha_failed'),
      rejected: true,
    },
    {
      error: new AuthApiError(
        'Rate limited',
        429,
        'over_email_send_rate_limit',
      ),
      rejected: true,
    },
    {
      error: new AuthRetryableFetchError('Network failure', 0),
      rejected: true,
    },
    {
      error: new AuthApiError('Unknown error', 400, undefined),
      rejected: false,
    },
    {
      error: new AuthApiError('Server failure', 500, 'captcha_failed'),
      rejected: true,
    },
    {
      error: new AuthApiError('Timeout', 408, 'over_email_send_rate_limit'),
      rejected: true,
    },
    {
      error: new AuthApiError(
        'For security purposes, you can only request this after 30 seconds.',
        400,
        undefined,
      ),
      rejected: true,
    },
  ])(
    'preserves known SDK failures: $error.name/$error.status/$error.code => $rejected',
    async ({ error, rejected }) => {
      const signInWithOtp = jest
        .fn()
        .mockResolvedValue({ data: { user: null, session: null }, error });
      const result = await requestEmailOtp({
        client: { auth: { signInWithOtp } },
        email: 'test@example.com',
        intl,
      }).catch((requestError: unknown) => requestError);
      expect(result).toBeInstanceOf(OneKeyLocalError);
      expect(isEmailOtpSendKnownFailure(result)).toBe(rejected);
    },
  );

  test.each([0, 30])(
    'preserves message-only cooldown failures and their %s-second retry/toast metadata',
    async (retryAfterSeconds) => {
      const signInWithOtp = jest.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: new AuthApiError(
          `For security purposes, you can only request this after ${retryAfterSeconds} seconds.`,
          400,
          undefined,
        ),
      });
      const error = await requestEmailOtp({
        client: { auth: { signInWithOtp } },
        email: 'test@example.com',
        intl,
      }).catch((requestError: unknown) => requestError);
      expect(error).toMatchObject({
        data: { retryAfterSeconds, isEmailOtpSendFailure: true },
      });
      expect(getEmailOtpRequestErrorMessage({ error, intl })).toBe(
        `Retry after ${retryAfterSeconds} seconds.`,
      );
    },
  );

  test('passes a supplied token to the same OTP endpoint', async () => {
    const signInWithOtp = jest
      .fn()
      .mockResolvedValue({ data: { user: null, session: null }, error: null });
    await requestEmailOtp({
      client: { auth: { signInWithOtp } },
      email: 'test@example.com',
      captchaToken: 'test-token',
      intl,
    });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
      options: { shouldCreateUser: true, captchaToken: 'test-token' },
    });
  });
});
