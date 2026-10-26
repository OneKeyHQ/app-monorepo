import { OneKeyServerApiError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';

import {
  LOG_UPLOAD_TOKEN_EXPIRY_MARGIN_MS,
  LOG_UPLOAD_TOKEN_FALLBACK_TTL_MS,
  LogUploadError,
  isRetryableLogUploadError,
  isSniTimeoutErrorCode,
  isUploadTokenReusable,
  normalizeTokenExpiresAtMs,
  withLogUploadTimeout,
} from './logUploadUtils';

const NOW = 1_800_000_000_000;
const digest = { sha256: 'abc', sizeBytes: 1_100_000 };

describe('normalizeTokenExpiresAtMs', () => {
  test('accepts seconds and milliseconds', () => {
    expect(normalizeTokenExpiresAtMs(NOW / 1000 + 600, NOW)).toBe(
      NOW + 600_000,
    );
    expect(normalizeTokenExpiresAtMs(NOW + 600_000, NOW)).toBe(NOW + 600_000);
  });

  test('falls back to a short TTL for missing or past values', () => {
    expect(normalizeTokenExpiresAtMs(undefined, NOW)).toBe(
      NOW + LOG_UPLOAD_TOKEN_FALLBACK_TTL_MS,
    );
    expect(normalizeTokenExpiresAtMs(Number.NaN, NOW)).toBe(
      NOW + LOG_UPLOAD_TOKEN_FALLBACK_TTL_MS,
    );
    expect(normalizeTokenExpiresAtMs(NOW - 1, NOW)).toBe(
      NOW + LOG_UPLOAD_TOKEN_FALLBACK_TTL_MS,
    );
  });
});

describe('isUploadTokenReusable', () => {
  const cache = {
    uploadToken: 'token',
    expiresAtMs: NOW + 10 * 60_000,
    ...digest,
  };

  test('reuses a valid token for the same archive', () => {
    expect(isUploadTokenReusable(cache, digest, NOW)).toBe(true);
  });

  test('requests a new token near expiry or for another archive', () => {
    expect(isUploadTokenReusable(undefined, digest, NOW)).toBe(false);
    expect(
      isUploadTokenReusable(
        cache,
        digest,
        cache.expiresAtMs - LOG_UPLOAD_TOKEN_EXPIRY_MARGIN_MS,
      ),
    ).toBe(false);
    expect(
      isUploadTokenReusable(cache, { ...digest, sha256: 'other' }, NOW),
    ).toBe(false);
    expect(isUploadTokenReusable(cache, { ...digest, sizeBytes: 1 }, NOW)).toBe(
      false,
    );
  });
});

describe('isRetryableLogUploadError', () => {
  test('retries network errors and HTTP 5xx only', () => {
    expect(
      isRetryableLogUploadError(
        new LogUploadError({ reason: 'network', message: 'offline' }),
      ),
    ).toBe(true);
    expect(
      isRetryableLogUploadError(
        new LogUploadError({ reason: 'http', httpStatus: 502, message: '' }),
      ),
    ).toBe(true);
    expect(
      isRetryableLogUploadError(
        new LogUploadError({ reason: 'http', httpStatus: 413, message: '' }),
      ),
    ).toBe(false);
    expect(
      isRetryableLogUploadError(
        new LogUploadError({ reason: 'timeout', message: 'slow' }),
      ),
    ).toBe(false);
  });

  test('does not retry server business errors such as rate limiting', () => {
    expect(
      isRetryableLogUploadError(
        new OneKeyServerApiError({ message: 'limited', code: 12_001 }),
      ),
    ).toBe(false);
    // Shape after crossing the background bridge.
    expect(
      isRetryableLogUploadError({
        className: EOneKeyErrorClassNames.OneKeyServerApiError,
        code: 12_001,
        message: 'limited',
      }),
    ).toBe(false);
  });

  test('keeps retrying unclassified transport errors', () => {
    expect(isRetryableLogUploadError(new Error('Network Error'))).toBe(true);
  });
});

describe('isSniTimeoutErrorCode', () => {
  test('matches native SNI timeout codes', () => {
    expect(isSniTimeoutErrorCode('SNI_REQUEST_TIMEOUT')).toBe(true);
    expect(isSniTimeoutErrorCode('SNI_TIMEOUT')).toBe(true);
    expect(isSniTimeoutErrorCode('SNI_TLS_FAILED')).toBe(false);
  });
});

describe('withLogUploadTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('resolves when the operation finishes in time', async () => {
    const onTimeout = jest.fn();
    await expect(
      withLogUploadTimeout(Promise.resolve('ok'), 1000, onTimeout),
    ).resolves.toBe('ok');
    jest.runAllTimers();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  test('rejects with a timeout error and cancels the transport', async () => {
    const onTimeout = jest.fn();
    const pending = withLogUploadTimeout(
      new Promise<never>(() => undefined),
      1000,
      onTimeout,
    );
    jest.advanceTimersByTime(1000);

    await expect(pending).rejects.toMatchObject({ reason: 'timeout' });
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });
});
