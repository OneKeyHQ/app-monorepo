import { isRetryableSupabaseAuthError } from './supabaseAuthErrorUtils';

describe('isRetryableSupabaseAuthError', () => {
  describe('name-based classification', () => {
    test('AuthRetryableFetchError is retryable even without a status', () => {
      expect(
        isRetryableSupabaseAuthError({ name: 'AuthRetryableFetchError' }),
      ).toBe(true);
    });

    test('AuthRetryableFetchError with status 0 (fetch-level failure) is retryable', () => {
      expect(
        isRetryableSupabaseAuthError({
          name: 'AuthRetryableFetchError',
          status: 0,
        }),
      ).toBe(true);
    });

    test('AuthUnknownError (unparseable non-2xx body, e.g. CDN HTML page) is retryable', () => {
      // Recent fix: an unparseable body is never a definite GoTrue rejection.
      expect(isRetryableSupabaseAuthError({ name: 'AuthUnknownError' })).toBe(
        true,
      );
    });

    test('AuthUnknownError stays retryable even when a 4xx status is attached', () => {
      // Name-based match runs before the status allowlist, so an
      // AuthUnknownError wrapping a Cloudflare 520-style page with a
      // non-allowlisted status is still retryable.
      expect(
        isRetryableSupabaseAuthError({ name: 'AuthUnknownError', status: 400 }),
      ).toBe(true);
    });
  });

  describe('status-based classification (AuthApiError shapes)', () => {
    test.each([500, 502, 503, 504, 599])(
      'HTTP %i (5xx) is retryable',
      (status) => {
        expect(
          isRetryableSupabaseAuthError({ name: 'AuthApiError', status }),
        ).toBe(true);
      },
    );

    test('HTTP 408 (request timeout) is retryable', () => {
      expect(
        isRetryableSupabaseAuthError({ name: 'AuthApiError', status: 408 }),
      ).toBe(true);
    });

    test('HTTP 429 (rate limit) is retryable', () => {
      expect(
        isRetryableSupabaseAuthError({ name: 'AuthApiError', status: 429 }),
      ).toBe(true);
    });

    test.each([400, 401, 403, 404, 422])(
      'HTTP %i is a definite rejection (not retryable)',
      (status) => {
        expect(
          isRetryableSupabaseAuthError({ name: 'AuthApiError', status }),
        ).toBe(false);
      },
    );

    test('HTTP 600 is outside the 5xx range and not retryable', () => {
      expect(
        isRetryableSupabaseAuthError({ name: 'AuthApiError', status: 600 }),
      ).toBe(false);
    });

    test('a string status is ignored (structural typing requires a number)', () => {
      expect(
        isRetryableSupabaseAuthError({ name: 'AuthApiError', status: '503' }),
      ).toBe(false);
    });
  });

  describe('non-auth-error inputs', () => {
    test('plain Error without status is not retryable', () => {
      // eslint-disable-next-line onekey/no-raw-error -- intentional: testing plain Error input
      expect(isRetryableSupabaseAuthError(new Error('boom'))).toBe(false);
    });

    test('undefined is not retryable', () => {
      expect(isRetryableSupabaseAuthError(undefined)).toBe(false);
    });

    test('null is not retryable', () => {
      expect(isRetryableSupabaseAuthError(null)).toBe(false);
    });

    test('empty object is not retryable', () => {
      expect(isRetryableSupabaseAuthError({})).toBe(false);
    });

    test('string input is not retryable', () => {
      expect(isRetryableSupabaseAuthError('AuthRetryableFetchError')).toBe(
        false,
      );
    });
  });
});
