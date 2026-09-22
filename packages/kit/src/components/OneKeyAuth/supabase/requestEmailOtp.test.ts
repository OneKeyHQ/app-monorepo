import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { createIntl } from 'react-intl';

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
    getSanitizedAuthErrorText: () => 'sanitized error',
    logOneKeyIdLoginFailureReason: jest.fn(),
  }),
);

const messages: Record<string, string> = {
  [ETranslations.global_unknown_error_retry_message]: 'Please try again.',
  [ETranslations.email_verification_rate_limit]: 'Retry after {rest} seconds.',
};
const intl = createIntl({ locale: 'en', messages });

describe('Email OTP request security boundary', () => {
  test('preserves the v6.5.0 CAPTCHA error message from Supabase through the toast boundary', async () => {
    const message =
      'captcha protection: request disallowed (no captcha_token found)';
    const signInWithOtp = jest.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError(message, 400, 'captcha_failed'),
    });
    const request = requestEmailOtp({
      client: { auth: { signInWithOtp } },
      email: 'test@example.com',
      intl,
    });
    await expect(request).rejects.toBeInstanceOf(OneKeyLocalError);
    await expect(request).rejects.toThrow(message);
    const toastMessage = await request.catch((error: unknown) =>
      getEmailOtpRequestErrorMessage({ error, intl }),
    );
    expect(toastMessage).toBe(message);
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
      rejected: false,
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
