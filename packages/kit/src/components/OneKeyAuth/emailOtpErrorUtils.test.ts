import { AuthApiError } from '@supabase/supabase-js';
import { createIntl } from 'react-intl';

import enCatalog from '@onekeyhq/shared/src/locale/json/en_US.json';
import zhCatalog from '@onekeyhq/shared/src/locale/json/zh_CN.json';

import {
  getEmailAuthCaptchaErrorMessage,
  getEmailOtpRequestErrorMessage,
} from './emailOtpErrorUtils';

const enMessages: Record<string, string> = enCatalog;
const zhMessages: Record<string, string> = zhCatalog;

describe('email authentication CAPTCHA messages', () => {
  test.each([
    {
      locale: 'en-US',
      messages: enMessages,
      expected: 'Security verification was not completed. Please try again.',
    },
    {
      locale: 'zh-CN',
      messages: zhMessages,
      expected: '安全验证未完成，请重试。',
    },
  ])(
    'uses the bundled $locale copy without modifying the SDK error',
    ({ locale, messages, expected }) => {
      const intl = createIntl({ locale, messages });
      const message =
        'captcha protection: request disallowed (no captcha_token found)';
      const error = new AuthApiError(message, 400, 'captcha_failed');
      expect(getEmailOtpRequestErrorMessage({ error, intl })).toBe(expected);
      expect(error.message).toBe(message);
      expect(error.code).toBe('captcha_failed');
    },
  );

  test.each([
    new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
    new AuthApiError('CAPTCHA-like text with no error code', 400, undefined),
    new AuthApiError('Server unavailable', 500, 'captcha_failed'),
    new Error(
      'captcha protection: request disallowed (no captcha_token found)',
    ),
    undefined,
  ])('does not relabel unrelated or unstructured errors: $message', (error) => {
    const intl = createIntl({ locale: 'en-US', messages: enMessages });
    expect(getEmailAuthCaptchaErrorMessage({ error, intl })).toBeUndefined();
  });

  test('preserves password errors and suppresses duplicate automatic toasts', () => {
    const intl = createIntl({ locale: 'en-US', messages: enMessages });
    expect(
      getEmailOtpRequestErrorMessage({
        error: new AuthApiError(
          'Invalid login credentials',
          400,
          'invalid_credentials',
        ),
        intl,
      }),
    ).toBe('Invalid login credentials');
    const error = Object.assign(
      new AuthApiError('CAPTCHA rejected', 400, 'captcha_failed'),
      { autoToast: true },
    );
    expect(getEmailOtpRequestErrorMessage({ error, intl })).toBeUndefined();
  });
});
