import { scrubSensitiveErrorMessageText } from './oneKeyIdLoginToastUtils';

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
});
