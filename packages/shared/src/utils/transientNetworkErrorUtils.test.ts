import { EOneKeyErrorClassNames } from '../errors/types/errorTypes';

import { SupabaseStorageTransientError } from './supabaseAuthErrorUtils';
import { isTransientNetworkLikeError } from './transientNetworkErrorUtils';

describe('isTransientNetworkLikeError', () => {
  describe('retryable supabase auth/storage errors (name-based, bridge-safe)', () => {
    test.each([
      'AuthRetryableFetchError',
      'SupabaseStorageTransientError',
      'AuthUnknownError',
    ])('error name %s is transient', (name) => {
      expect(isTransientNetworkLikeError({ name })).toBe(true);
    });

    test('SupabaseStorageTransientError instance is transient', () => {
      expect(
        isTransientNetworkLikeError(
          new SupabaseStorageTransientError('device key store unavailable'),
        ),
      ).toBe(true);
    });

    test('definitive auth rejections (AuthApiError 400) are not transient', () => {
      expect(
        isTransientNetworkLikeError({ name: 'AuthApiError', status: 400 }),
      ).toBe(false);
    });
  });

  describe('className-based classification (bridge-serialized OneKey errors)', () => {
    test('AxiosNetworkError className is transient', () => {
      expect(
        isTransientNetworkLikeError({
          className: EOneKeyErrorClassNames.AxiosNetworkError,
        }),
      ).toBe(true);
    });

    test('other OneKey classNames are not transient by themselves', () => {
      expect(
        isTransientNetworkLikeError({
          className: EOneKeyErrorClassNames.OneKeyError,
        }),
      ).toBe(false);
    });
  });

  describe('httpStatusCode-based classification', () => {
    test.each([500, 502, 503, 504, 599])(
      'HTTP %i (5xx) is transient',
      (httpStatusCode) => {
        expect(isTransientNetworkLikeError({ httpStatusCode })).toBe(true);
      },
    );

    test('HTTP 408 (request timeout) is transient', () => {
      expect(isTransientNetworkLikeError({ httpStatusCode: 408 })).toBe(true);
    });

    test('HTTP 429 (rate limit) is transient', () => {
      expect(isTransientNetworkLikeError({ httpStatusCode: 429 })).toBe(true);
    });

    test.each([400, 401, 403, 404, 422])(
      'HTTP %i is a definite rejection (not transient)',
      (httpStatusCode) => {
        expect(isTransientNetworkLikeError({ httpStatusCode })).toBe(false);
      },
    );

    test('2xx response with a non-zero business code is not transient', () => {
      // Server business rejection: HTTP 200 + business error code.
      expect(
        isTransientNetworkLikeError({ httpStatusCode: 200, code: 40_001 }),
      ).toBe(false);
    });

    test('a string httpStatusCode is ignored', () => {
      expect(isTransientNetworkLikeError({ httpStatusCode: '503' })).toBe(
        false,
      );
    });
  });

  describe('axios error-code-based classification', () => {
    test.each([
      'ECONNABORTED',
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ERR_NETWORK',
    ])('axios code %s is transient', (code) => {
      expect(isTransientNetworkLikeError({ code })).toBe(true);
    });

    test('axios business codes like ERR_BAD_REQUEST are not transient', () => {
      expect(isTransientNetworkLikeError({ code: 'ERR_BAD_REQUEST' })).toBe(
        false,
      );
    });

    test('numeric codes are ignored (only string axios codes match)', () => {
      expect(isTransientNetworkLikeError({ code: 500 })).toBe(false);
    });
  });

  describe('fetch-style network errors (KNOWN GAP - characterization only)', () => {
    // CHARACTERIZATION, NOT ENDORSEMENT: fetch-based stacks surface network
    // failures as a bare TypeError with no `code` / `httpStatusCode` /
    // `className` (React Native: "Network request failed", browsers:
    // "Failed to fetch"). The current implementation matches only on
    // className / httpStatusCode / axios `code`, so these are classified as
    // NOT transient. These tests lock in the current behavior; if the util
    // is ever taught to recognize fetch-style errors, update them.
    test('TypeError("Network request failed") is currently NOT classified as transient', () => {
      expect(
        isTransientNetworkLikeError(new TypeError('Network request failed')),
      ).toBe(false);
    });

    test('TypeError("Failed to fetch") is currently NOT classified as transient', () => {
      expect(
        isTransientNetworkLikeError(new TypeError('Failed to fetch')),
      ).toBe(false);
    });
  });

  describe('non-error inputs', () => {
    test('undefined is not transient', () => {
      expect(isTransientNetworkLikeError(undefined)).toBe(false);
    });

    test('null is not transient', () => {
      expect(isTransientNetworkLikeError(null)).toBe(false);
    });

    test('plain Error without code/status is not transient', () => {
      // eslint-disable-next-line onekey/no-raw-error -- intentional: testing plain Error input
      expect(isTransientNetworkLikeError(new Error('boom'))).toBe(false);
    });

    test('empty object is not transient', () => {
      expect(isTransientNetworkLikeError({})).toBe(false);
    });
  });
});
