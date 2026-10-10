import { Toast } from '@onekeyhq/components';
import {
  EOAuthSocialLoginProvider,
  OAUTH_FLOW_TIMEOUT_ERROR_MESSAGE,
} from '@onekeyhq/shared/src/consts/authConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  getOneKeyIdAuthFailureServerParams,
  getSanitizedErrorLogText,
} from '@onekeyhq/shared/src/utils/sensitiveErrorMessageUtils';

import {
  getOAuthSignInFailureInfo,
  logOneKeyIdLoginFailureReason,
  noteOAuthSignInOutcome,
  scrubSensitiveErrorMessageText,
  showOneKeyIdLoginFailedToast,
  throwLocalizedOneKeyIdLoginError,
} from './oneKeyIdLoginToastUtils';

const mockOneKeyIdLoginFailedReason = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    error: jest.fn(),
    message: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        onekeyIdLoginFailedReason: (...args: unknown[]) => {
          mockOneKeyIdLoginFailedReason(...args);
        },
        onekeyIdLoginFailedToast: jest.fn(),
      },
    },
  },
}));

describe('scrubSensitiveErrorMessageText', () => {
  test('redacts JWTs', () => {
    expect(
      scrubSensitiveErrorMessageText(
        'setSession failed: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c rejected',
      ),
    ).toBe('setSession failed: [jwt] rejected');
  });

  test('redacts bearer credentials', () => {
    expect(
      scrubSensitiveErrorMessageText('401 with Bearer abc.DEF-123~x= header'),
    ).toBe('401 with Bearer [token] header');
  });

  test('strips URL query strings and fragments', () => {
    expect(
      scrubSensitiveErrorMessageText(
        'fetch failed for https://oauth-callback.onekey.so/cb?code=4/abc&state=xyz retry later',
      ),
    ).toBe('fetch failed for https://oauth-callback.onekey.so/cb retry later');
    expect(
      scrubSensitiveErrorMessageText(
        'redirect https://example.com/page#access_token=abc123',
      ),
    ).toBe('redirect https://example.com/page');
  });

  test('redacts bare token params outside URLs', () => {
    expect(
      scrubSensitiveErrorMessageText(
        'body was access_token=at_123&refresh_token=rt_456',
      ),
    ).toBe('body was access_token=[redacted]&refresh_token=[redacted]');
  });

  test('redacts colon-delimited and JSON token values', () => {
    expect(
      scrubSensitiveErrorMessageText(
        'refresh_token: opaque-secret access_token: another-secret',
      ),
    ).toBe('refresh_token: [redacted] access_token: [redacted]');
    expect(
      scrubSensitiveErrorMessageText(
        '{"refresh_token":"opaque-secret","access_token": "another-secret"}',
      ),
    ).toBe('{"refresh_token":"[redacted]","access_token": "[redacted]"}');
  });

  test('redacts alternate credential labels and unlabeled opaque values', () => {
    expect(
      scrubSensitiveErrorMessageText(
        '{"refreshToken":"opaque-secret","session_id":"session-secret","cookie":"auth=secret"}',
      ),
    ).toBe(
      '{"refreshToken":"[redacted]","session_id":"[redacted]","cookie":"[redacted]"}',
    );
    expect(
      scrubSensitiveErrorMessageText(
        'request failed with AbCdEfGhIjKlMnOpQrStUvWxYz123456',
      ),
    ).toBe('request failed with [credential]');
  });

  test('keeps request UUIDs and URL paths readable', () => {
    const requestId = '3f8a1c92-7d4e-4b16-9c0a-5e2b7f13a840';

    expect(
      scrubSensitiveErrorMessageText(
        `requestId=${requestId} url=https://api.onekey.so/prime/v1/account/oauth/login`,
      ),
    ).toBe(
      `requestId=${requestId} url=https://api.onekey.so/prime/v1/account/oauth/login`,
    );
  });

  test('keeps error-code params readable', () => {
    expect(
      scrubSensitiveErrorMessageText('rejected with code=otp_expired'),
    ).toBe('rejected with code=otp_expired');
  });

  test('redacts email addresses', () => {
    expect(
      scrubSensitiveErrorMessageText('user test+auth@example.com not found'),
    ).toBe('user [email] not found');
  });

  test('caps the message length', () => {
    const scrubbed = scrubSensitiveErrorMessageText('a'.repeat(500));
    expect(scrubbed.length).toBeLessThanOrEqual(203);
    expect(scrubbed.endsWith('...')).toBe(true);
  });

  test('keeps ordinary diagnostics unchanged', () => {
    expect(
      scrubSensitiveErrorMessageText(
        'OneKey ID OAuth sign-in failed: name=AuthApiError message=Invalid grant code=400 status=400 requestId=req_1',
      ),
    ).toBe(
      'OneKey ID OAuth sign-in failed: name=AuthApiError message=Invalid grant code=400 status=400 requestId=req_1',
    );
  });

  test('sanitizes nested error causes used by background wrappers', () => {
    const error = new Error(
      'Keyless passive migration network error',
    ) as Error & {
      cause?: Error;
    };
    error.cause = new Error(
      'request for test+auth@example.com failed with access_token=secret',
    );

    expect(getSanitizedErrorLogText(error)).toContain(
      'cause=request for [email] failed with access_token=[redacted]',
    );
  });

  test('keeps free-form reasons out of server telemetry', () => {
    const secret = 'AbCdEfGhIjKlMnOpQrStUvWxYz123456';
    const requestId = '3f8a1c92-7d4e-4b16-9c0a-5e2b7f13a840';
    const params = getOneKeyIdAuthFailureServerParams({
      source: 'throwSite',
      reason: `ServicePrime.apiOAuthLogin: OneKey ID is already logged in. name=OneKeyLocalError message=${secret} code=auth_conflict status=409 requestId=${requestId} cause=refreshToken:${secret}`,
    });

    expect(params).toEqual({
      source: 'throwSite',
      category: 'alreadyLoggedIn',
      errorName: 'OneKeyLocalError',
      errorCode: 'auth_conflict',
      httpStatusCode: 409,
      requestId,
    });
    expect(JSON.stringify(params)).not.toContain(secret);
    expect(params).not.toHaveProperty('reason');
  });
});

describe('logOneKeyIdLoginFailureReason', () => {
  test('logs a sanitized reason once for the same error object', () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const error = new Error('request failed');

    logOneKeyIdLoginFailureReason(
      'OAuth failed for test+auth@example.com with access_token=secret',
      error,
    );
    logOneKeyIdLoginFailureReason('duplicate', error);

    expect(mockOneKeyIdLoginFailedReason).toHaveBeenCalledTimes(1);
    expect(mockOneKeyIdLoginFailedReason).toHaveBeenCalledWith({
      reason: 'OAuth failed for [email] with access_token=[redacted]',
    });
    consoleErrorSpy.mockRestore();
  });
});

describe('showOneKeyIdLoginFailedToast', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('shows the sanitized underlying error instead of a generic fallback', () => {
    const intl = {
      formatMessage: jest.fn(() => 'Unknown error. Please try again.'),
    };

    showOneKeyIdLoginFailedToast({
      error: new Error(
        'Failed to persist Keyless OAuth session for test+auth@example.com',
      ),
      intl: intl as never,
    });

    expect(Toast.error).toHaveBeenCalledWith({
      title: 'Failed to persist Keyless OAuth session for [email]',
    });
    expect(intl.formatMessage).not.toHaveBeenCalled();
  });

  test('does not replace a frozen third-party error while marking the toast', () => {
    const error = Object.freeze(new Error('Frozen OAuth SDK error'));

    expect(() =>
      showOneKeyIdLoginFailedToast({
        error,
        intl: { formatMessage: jest.fn() } as never,
      }),
    ).not.toThrow();
    expect(Toast.error).toHaveBeenCalledWith({
      title: 'Frozen OAuth SDK error',
    });
  });

  test('logs the reason when a global auto toast already handled the UI', () => {
    const error = new Error('OAuth session refresh failed') as Error & {
      $$autoToastErrorTriggered?: boolean;
    };
    error.$$autoToastErrorTriggered = true;

    showOneKeyIdLoginFailedToast({
      error,
      intl: { formatMessage: jest.fn() } as never,
    });

    expect(Toast.error).not.toHaveBeenCalled();
    expect(mockOneKeyIdLoginFailedReason).toHaveBeenCalledWith({
      reason: 'OneKey ID fallback toast skipped: OAuth session refresh failed',
    });
  });

  test('logs the reason when manual and auto toasts are disabled', () => {
    const error = new Error('Post-login continuation failed') as Error & {
      autoToast?: boolean;
    };
    error.autoToast = false;

    showOneKeyIdLoginFailedToast({
      error,
      intl: { formatMessage: jest.fn() } as never,
    });

    expect(Toast.error).not.toHaveBeenCalled();
    expect(mockOneKeyIdLoginFailedReason).toHaveBeenCalledWith({
      reason:
        'OneKey ID fallback toast skipped: Post-login continuation failed',
    });
  });
});

describe('getOAuthSignInFailureInfo', () => {
  const originalIsNativeAndroid = platformEnv.isNativeAndroid;
  const originalIsExtension = platformEnv.isExtension;
  // Shape of the GoogleSignin.signIn() rejection when Play services cannot
  // reach Google (CommonStatusCodes.NETWORK_ERROR).
  const googleNetworkError = Object.assign(new Error('NETWORK_ERROR'), {
    name: 'com.google.android.gms.common.api.ApiException',
    code: '7',
  });

  afterEach(() => {
    platformEnv.isNativeAndroid = originalIsNativeAndroid;
    platformEnv.isExtension = originalIsExtension;
  });

  test('names the provider when Play services cannot reach Google', () => {
    platformEnv.isNativeAndroid = true;

    expect(
      getOAuthSignInFailureInfo({
        error: googleNetworkError,
        provider: EOAuthSocialLoginProvider.Google,
      }),
    ).toEqual({
      step: 'provider',
      key: ETranslations.auth_provider_sign_in_page_failed__msg,
      values: { provider: 'Google' },
    });
  });

  test('does not read the same code as a provider outage elsewhere', () => {
    expect(
      getOAuthSignInFailureInfo({
        error: googleNetworkError,
        provider: EOAuthSocialLoginProvider.Google,
      }),
    ).toEqual({});

    platformEnv.isNativeAndroid = true;
    expect(
      getOAuthSignInFailureInfo({
        error: googleNetworkError,
        provider: EOAuthSocialLoginProvider.Apple,
      }),
    ).toEqual({});
    expect(
      getOAuthSignInFailureInfo({
        error: Object.assign(new Error('INTERNAL_ERROR'), { code: '8' }),
        provider: EOAuthSocialLoginProvider.Google,
      }),
    ).toEqual({});
  });

  test.each([
    { name: 'AuthRetryableFetchError', status: 0 },
    { name: 'AuthRetryableFetchError', status: 503 },
    { name: 'AuthUnknownError' },
  ])(
    'asks to check the connection when the auth service fails with %j',
    (error) => {
      expect(
        getOAuthSignInFailureInfo({
          error,
          provider: EOAuthSocialLoginProvider.Apple,
        }),
      ).toEqual({
        step: 'auth',
        key: ETranslations.auth_sign_in_network_failed__msg,
      });
    },
  );

  test('names the provider when the extension sign-in page fails to load', () => {
    // chrome.identity.launchWebAuthFlow rejection; the failing hop is unknown.
    const loadFailure = new Error('Authorization page could not be loaded.');
    const args = {
      error: loadFailure,
      provider: EOAuthSocialLoginProvider.Apple,
    };

    expect(getOAuthSignInFailureInfo(args)).toEqual({});

    platformEnv.isExtension = true;
    expect(getOAuthSignInFailureInfo(args)).toEqual({
      key: ETranslations.auth_provider_sign_in_page_failed__msg,
      values: { provider: 'Apple' },
    });
  });

  test('offers the conditional hint when the browser flow times out', () => {
    expect(
      getOAuthSignInFailureInfo({
        error: new Error(OAUTH_FLOW_TIMEOUT_ERROR_MESSAGE),
        provider: EOAuthSocialLoginProvider.Google,
      }),
    ).toEqual({
      key: ETranslations.auth_provider_sign_in_page_hint__msg,
      values: { provider: 'Google' },
    });
  });

  test('keeps the generic copy for every other failure', () => {
    const rejected = getOAuthSignInFailureInfo({
      error: { name: 'AuthApiError', status: 400 },
      provider: EOAuthSocialLoginProvider.Google,
    });

    expect(rejected.step).toBe('auth');
    expect(rejected.key).toBeUndefined();
    expect(
      getOAuthSignInFailureInfo({
        error: new Error('OAuth state mismatch'),
        provider: EOAuthSocialLoginProvider.Google,
      }),
    ).toEqual({});
  });
});

describe('noteOAuthSignInOutcome', () => {
  const originalIsExtension = platformEnv.isExtension;
  const intl = {
    formatMessage: jest.fn(
      (_descriptor: unknown, values?: { provider?: string }) =>
        `hint for ${values?.provider ?? ''}`,
    ),
  };
  const note = (provider: EOAuthSocialLoginProvider, cancelled: boolean) =>
    noteOAuthSignInOutcome({ intl: intl as never, provider, cancelled });

  beforeEach(() => {
    jest.clearAllMocks();
    // Start every test without a remembered cancel.
    note(EOAuthSocialLoginProvider.Google, false);
  });

  afterEach(() => {
    platformEnv.isExtension = originalIsExtension;
  });

  test('hints when the same provider is cancelled twice in a row', () => {
    note(EOAuthSocialLoginProvider.Google, true);
    expect(Toast.message).not.toHaveBeenCalled();

    note(EOAuthSocialLoginProvider.Google, true);
    expect(Toast.message).toHaveBeenCalledWith({ title: 'hint for Google' });
    expect(intl.formatMessage).toHaveBeenCalledWith(
      { id: ETranslations.auth_provider_sign_in_page_hint__msg },
      { provider: 'Google' },
    );
  });

  test('stays silent when the cancels are not consecutive for one provider', () => {
    note(EOAuthSocialLoginProvider.Google, true);
    note(EOAuthSocialLoginProvider.Apple, true);
    note(EOAuthSocialLoginProvider.Apple, false);
    note(EOAuthSocialLoginProvider.Apple, true);

    expect(Toast.message).not.toHaveBeenCalled();
  });

  test('stays silent on the extension, where a cancel proves the page loaded', () => {
    platformEnv.isExtension = true;
    note(EOAuthSocialLoginProvider.Google, true);
    note(EOAuthSocialLoginProvider.Google, true);

    expect(Toast.message).not.toHaveBeenCalled();
  });
});

describe('throwLocalizedOneKeyIdLoginError', () => {
  test('formats the copy with its values and reports the failed step', () => {
    jest.clearAllMocks();
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const intl = {
      formatMessage: jest.fn(() => "Can't connect to Google"),
    };

    expect(() =>
      throwLocalizedOneKeyIdLoginError({
        intl: intl as never,
        reason: 'OneKey ID OAuth sign-in failed: name=Error',
        key: ETranslations.auth_provider_sign_in_page_failed__msg,
        values: { provider: 'Google' },
        step: 'provider',
      }),
    ).toThrow("Can't connect to Google");
    expect(intl.formatMessage).toHaveBeenCalledWith(
      { id: ETranslations.auth_provider_sign_in_page_failed__msg },
      { provider: 'Google' },
    );
    expect(mockOneKeyIdLoginFailedReason).toHaveBeenCalledWith({
      reason: 'OneKey ID OAuth sign-in failed: name=Error',
      step: 'provider',
    });
    consoleErrorSpy.mockRestore();
  });
});
