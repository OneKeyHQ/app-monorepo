import { Toast } from '@onekeyhq/components';
import {
  getOneKeyIdAuthFailureServerParams,
  getSanitizedErrorLogText,
} from '@onekeyhq/shared/src/utils/sensitiveErrorMessageUtils';

import {
  logOneKeyIdLoginFailureReason,
  scrubSensitiveErrorMessageText,
  showOneKeyIdLoginFailedToast,
} from './oneKeyIdLoginToastUtils';

const mockOneKeyIdLoginFailedReason = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    error: jest.fn(),
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
    const params = getOneKeyIdAuthFailureServerParams({
      source: 'throwSite',
      reason: `ServicePrime.apiOAuthLogin: OneKey ID is already logged in. name=OneKeyLocalError message=${secret} code=auth_conflict status=409 requestId=req-1 cause=refreshToken:${secret}`,
    });

    expect(params).toEqual({
      source: 'throwSite',
      category: 'alreadyLoggedIn',
      errorName: 'OneKeyLocalError',
      errorCode: 'auth_conflict',
      httpStatusCode: 409,
      requestId: 'req-1',
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
