import pRetry, { AbortError } from 'p-retry';

import { OneKeyServerApiError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';

import {
  LOG_UPLOAD_MAX_RETRIES,
  LOG_UPLOAD_TOKEN_EXPIRY_MARGIN_MS,
  LOG_UPLOAD_TOKEN_FALLBACK_TTL_MS,
  LogUploadError,
  canReuseUploadTokenAfterError,
  invalidateUploadTokenCacheAfterError,
  isRetryableLogUploadError,
  isSniPreWriteUploadErrorCode,
  isSniTimeoutErrorCode,
  isUploadTokenReusable,
  normalizeTokenExpiresAtMs,
  withLogUploadTimeout,
} from './logUploadUtils';

import type { ILogUploadTokenCache } from './logUploadUtils';

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
    expect(
      isUploadTokenReusable({ ...cache, consumed: true }, digest, NOW),
    ).toBe(false);
  });

  test('invalidates cached token after any error unless request was not sent', () => {
    const preSendError = new LogUploadError({
      reason: 'network',
      requestSent: false,
      message: 'failed before send',
    });
    expect(canReuseUploadTokenAfterError(preSendError)).toBe(true);
    const preserved = invalidateUploadTokenCacheAfterError(
      { ...cache },
      preSendError,
    );
    expect(isUploadTokenReusable(preserved, digest, NOW)).toBe(true);

    const http502Error = new LogUploadError({
      reason: 'http',
      httpStatus: 502,
      message: 'Bad Gateway',
    });
    expect(canReuseUploadTokenAfterError(http502Error)).toBe(false);
    const mutableCache: ILogUploadTokenCache = { ...cache };
    expect(
      invalidateUploadTokenCacheAfterError(mutableCache, http502Error),
    ).toBeUndefined();
    expect(isUploadTokenReusable(mutableCache, digest, NOW)).toBe(false);
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
        new LogUploadError({
          reason: 'network',
          retryable: false,
          message: 'SNI post-write failure',
        }),
      ),
    ).toBe(false);
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

  test('does not retry server business errors such as rate limiting, unless HTTP 5xx', () => {
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
    expect(
      isRetryableLogUploadError(
        new OneKeyServerApiError({
          message: 'Bad Gateway',
          code: 502,
          httpStatusCode: 502,
        }),
      ),
    ).toBe(true);
    expect(
      isRetryableLogUploadError({
        message: 'Too Many Requests',
        response: { status: 429 },
      }),
    ).toBe(false);
  });

  test('keeps retrying unclassified transport errors', () => {
    expect(isRetryableLogUploadError(new Error('Network Error'))).toBe(true);
  });
});

describe('isSniPreWriteUploadErrorCode', () => {
  test('allows domain fallback only for strictly pre-write SNI errors', () => {
    expect(isSniPreWriteUploadErrorCode('SNI_CONNECTION_REFUSED')).toBe(true);
    expect(isSniPreWriteUploadErrorCode('SNI_CERT_FAILED')).toBe(true);
    expect(isSniPreWriteUploadErrorCode('SNI_TLS_FAILED')).toBe(false);
    expect(isSniPreWriteUploadErrorCode('SNI_RESPONSE_FAILED')).toBe(false);
    expect(isSniPreWriteUploadErrorCode('SNI_NETWORK_UNREACHABLE')).toBe(false);
    expect(isSniPreWriteUploadErrorCode('SNI_TIMEOUT')).toBe(false);
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

describe('one-time upload token lifecycle with pRetry', () => {
  const createUploadFlow = ({
    onRequestToken,
    onUpload,
  }: {
    onRequestToken: (attempt: number) => Promise<{
      uploadToken: string;
      expiresAt: number;
    }>;
    onUpload: (params: {
      uploadToken: string;
      attempt: number;
      consumeServerToken: (token: string) => void;
    }) => Promise<string>;
  }) => {
    const activeServerTokens = new Set<string>();
    let tokenCache: ILogUploadTokenCache | undefined;
    let attempt = 0;
    let tokenRequests = 0;
    let uploadRequests = 0;

    const consumeServerToken = (token: string) => {
      if (!activeServerTokens.delete(token)) {
        throw new OneKeyServerApiError({
          message: 'Upload token already used or expired',
          code: 12_002,
        });
      }
    };

    const getUploadToken = async () => {
      if (isUploadTokenReusable(tokenCache, digest, NOW)) {
        return tokenCache.uploadToken;
      }
      tokenRequests += 1;
      const issued = await onRequestToken(attempt);
      activeServerTokens.add(issued.uploadToken);
      tokenCache = {
        uploadToken: issued.uploadToken,
        expiresAtMs: normalizeTokenExpiresAtMs(issued.expiresAt, NOW),
        sha256: digest.sha256,
        sizeBytes: digest.sizeBytes,
        consumed: false,
      };
      return issued.uploadToken;
    };

    const run = () =>
      pRetry(
        async () => {
          attempt += 1;
          let uploadDispatched = false;
          try {
            const uploadToken = await getUploadToken();
            uploadDispatched = true;
            uploadRequests += 1;
            return await onUpload({
              uploadToken,
              attempt,
              consumeServerToken,
            });
          } catch (error) {
            if (uploadDispatched) {
              tokenCache = invalidateUploadTokenCacheAfterError(
                tokenCache,
                error,
              );
            }
            if (!isRetryableLogUploadError(error)) {
              throw new AbortError(
                error instanceof Error ? error : new Error(String(error)),
              );
            }
            throw error;
          }
        },
        { retries: LOG_UPLOAD_MAX_RETRIES, minTimeout: 0, maxTimeout: 0 },
      );

    return {
      run,
      getStats: () => ({ tokenRequests, uploadRequests }),
    };
  };

  test('requests a fresh token on retry after server consumes token and upstream returns HTTP 502', async () => {
    const flow = createUploadFlow({
      onRequestToken: async (attempt) => ({
        uploadToken: `token-${attempt}`,
        expiresAt: NOW + 5 * 60_000,
      }),
      onUpload: async ({ uploadToken, attempt, consumeServerToken }) => {
        consumeServerToken(uploadToken);
        if (attempt === 1) {
          throw new LogUploadError({
            reason: 'http',
            httpStatus: 502,
            message: 'Upload failed: invalid response (HTTP 502)',
          });
        }
        return 'logs/uploaded.zip';
      },
    });

    await expect(flow.run()).resolves.toBe('logs/uploaded.zip');
    expect(flow.getStats()).toEqual({
      tokenRequests: 2,
      uploadRequests: 2,
    });
  });

  test('stops immediately when requesting a fresh token after HTTP 502 hits rate limiting (12001)', async () => {
    const flow = createUploadFlow({
      onRequestToken: async (attempt) => {
        if (attempt === 2) {
          throw new OneKeyServerApiError({
            message: 'Rate limit exceeded',
            code: 12_001,
          });
        }
        return {
          uploadToken: `token-${attempt}`,
          expiresAt: NOW + 5 * 60_000,
        };
      },
      onUpload: async ({ uploadToken, consumeServerToken }) => {
        consumeServerToken(uploadToken);
        throw new LogUploadError({
          reason: 'http',
          httpStatus: 502,
          message: 'Bad Gateway',
        });
      },
    });

    await expect(flow.run()).rejects.toThrow('Rate limit exceeded');
    expect(flow.getStats()).toEqual({
      tokenRequests: 2,
      uploadRequests: 1,
    });
  });

  test('does not retry when upload loses response after writing (ambiguous post-write failure)', async () => {
    const flow = createUploadFlow({
      onRequestToken: async (attempt) => ({
        uploadToken: `token-${attempt}`,
        expiresAt: NOW + 5 * 60_000,
      }),
      onUpload: async ({ uploadToken, consumeServerToken }) => {
        consumeServerToken(uploadToken);
        throw new LogUploadError({
          reason: 'network',
          retryable: false,
          message: 'SNI upload failed (SNI_RESPONSE_FAILED)',
        });
      },
    });

    await expect(flow.run()).rejects.toThrow('SNI_RESPONSE_FAILED');
    expect(flow.getStats()).toEqual({
      tokenRequests: 1,
      uploadRequests: 1,
    });
  });

  test('safely reuses unconsumed token when attempt fails before sending request', async () => {
    const flow = createUploadFlow({
      onRequestToken: async (attempt) => ({
        uploadToken: `token-${attempt}`,
        expiresAt: NOW + 5 * 60_000,
      }),
      onUpload: async ({ uploadToken, attempt, consumeServerToken }) => {
        if (attempt === 1) {
          throw new LogUploadError({
            reason: 'network',
            requestSent: false,
            message: 'Failed before sending upload request',
          });
        }
        consumeServerToken(uploadToken);
        return 'logs/uploaded-reused.zip';
      },
    });

    await expect(flow.run()).resolves.toBe('logs/uploaded-reused.zip');
    expect(flow.getStats()).toEqual({
      tokenRequests: 1,
      uploadRequests: 2,
    });
  });
});
