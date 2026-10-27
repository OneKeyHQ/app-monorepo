import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';

// Bounded so a slow network falls back to manual export instead of hanging.
// The native SNI transport accepts at most 120s.
export const LOG_UPLOAD_TIMEOUT_MS = 90_000;

// Only fast transient failures are retried; a timeout already used the
// whole budget and server rejections will not change on retry.
export const LOG_UPLOAD_MAX_RETRIES = 1;

// Keep a margin so a token does not expire while the body is in flight.
export const LOG_UPLOAD_TOKEN_EXPIRY_MARGIN_MS = 30_000;

// Used when the server omits or garbles expiresAt.
export const LOG_UPLOAD_TOKEN_FALLBACK_TTL_MS = 5 * 60_000;

const SNI_TIMEOUT_ERROR_CODES = new Set(['SNI_TIMEOUT', 'SNI_REQUEST_TIMEOUT']);

export type ILogUploadErrorReason = 'timeout' | 'network' | 'http';

export class LogUploadError extends OneKeyLocalError {
  readonly reason: ILogUploadErrorReason;

  readonly httpStatus?: number;

  constructor({
    reason,
    message,
    httpStatus,
  }: {
    reason: ILogUploadErrorReason;
    message: string;
    httpStatus?: number;
  }) {
    super(message);
    this.reason = reason;
    this.httpStatus = httpStatus;
  }
}

export type ILogUploadTokenCache = {
  uploadToken: string;
  expiresAtMs: number;
  sha256: string;
  sizeBytes: number;
};

/**
 * Accepts `expiresAt` in seconds or milliseconds since epoch.
 */
export function normalizeTokenExpiresAtMs(
  expiresAt: unknown,
  issuedAtMs: number,
): number {
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
    return issuedAtMs + LOG_UPLOAD_TOKEN_FALLBACK_TTL_MS;
  }
  const expiresAtMs = expiresAt < 1e12 ? expiresAt * 1000 : expiresAt;
  if (expiresAtMs <= issuedAtMs) {
    return issuedAtMs + LOG_UPLOAD_TOKEN_FALLBACK_TTL_MS;
  }
  return expiresAtMs;
}

/**
 * A token is bound to the archive it was issued for (size + sha256), so it
 * can only be reused for the same digest.
 */
export function isUploadTokenReusable(
  cache: ILogUploadTokenCache | undefined,
  digest: { sha256: string; sizeBytes: number },
  nowMs: number,
): cache is ILogUploadTokenCache {
  return Boolean(
    cache &&
    cache.sha256 === digest.sha256 &&
    cache.sizeBytes === digest.sizeBytes &&
    cache.expiresAtMs - LOG_UPLOAD_TOKEN_EXPIRY_MARGIN_MS > nowMs,
  );
}

export function isSniTimeoutErrorCode(code: string): boolean {
  return SNI_TIMEOUT_ERROR_CODES.has(code);
}

/**
 * Retry only failures that are cheap to repeat and may succeed next time.
 * Timeouts, HTTP 4xx and server business errors (e.g. rate limiting on the
 * token endpoint) are terminal; other transport errors stay retryable so
 * platforms without classified upload errors keep their retry.
 */
export function isRetryableLogUploadError(error: unknown): boolean {
  if (error instanceof LogUploadError) {
    if (error.reason === 'network') {
      return true;
    }
    return (
      error.reason === 'http' &&
      typeof error.httpStatus === 'number' &&
      error.httpStatus >= 500
    );
  }
  // Errors crossing the background bridge may lose their prototype.
  const className = (error as { className?: unknown } | undefined)?.className;
  return className !== EOneKeyErrorClassNames.OneKeyServerApiError;
}

/**
 * Resolves with `operation`, or rejects with a timeout `LogUploadError` and
 * calls `onTimeout` so the caller can cancel the underlying transport.
 */
export async function withLogUploadTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      try {
        onTimeout?.();
      } finally {
        reject(
          new LogUploadError({
            reason: 'timeout',
            message: `Log upload timed out after ${timeoutMs}ms`,
          }),
        );
      }
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
