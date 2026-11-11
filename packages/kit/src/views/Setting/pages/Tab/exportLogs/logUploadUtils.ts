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

// Errors that occur before any request body bytes are written to the socket,
// so falling back to the domain upload route cannot duplicate the POST.
// Note: SNI_TLS_FAILED is intentionally excluded because on Android and
// Desktop TLS/SSL stream errors can also surface after body bytes are written.
const SNI_PRE_WRITE_UPLOAD_ERROR_CODES = new Set([
  'SNI_UNSUPPORTED',
  'SNI_INVALID_CONFIG',
  'SNI_INVALID_URL',
  'SNI_DNS_FAILED',
  'SNI_CONNECTION_REFUSED',
  'SNI_CERT_FAILED',
  'SNI_SECURITY_POLICY_FAILED',
  'SNI_RESOURCE_LIMIT',
]);

export type ILogUploadErrorReason = 'timeout' | 'network' | 'http';

export class LogUploadError extends OneKeyLocalError {
  readonly reason: ILogUploadErrorReason;

  readonly httpStatus?: number;

  readonly retryable?: boolean;

  readonly requestSent?: boolean;

  constructor({
    reason,
    message,
    httpStatus,
    retryable,
    requestSent,
  }: {
    reason: ILogUploadErrorReason;
    message: string;
    httpStatus?: number;
    retryable?: boolean;
    requestSent?: boolean;
  }) {
    super(message);
    this.reason = reason;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
    this.requestSent = requestSent;
  }
}

export type ILogUploadTokenCache = {
  uploadToken: string;
  expiresAtMs: number;
  sha256: string;
  sizeBytes: number;
  consumed?: boolean;
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
 * A token is single-use on the server (consumed on controller entry) and
 * bound to the archive it was issued for (size + sha256), so it can only be
 * reused for the same digest when the previous attempt proved the upload
 * request was never sent (`!cache.consumed`).
 */
export function isUploadTokenReusable(
  cache: ILogUploadTokenCache | undefined,
  digest: { sha256: string; sizeBytes: number },
  nowMs: number,
): cache is ILogUploadTokenCache {
  return Boolean(
    cache &&
    !cache.consumed &&
    cache.sha256 === digest.sha256 &&
    cache.sizeBytes === digest.sizeBytes &&
    cache.expiresAtMs - LOG_UPLOAD_TOKEN_EXPIRY_MARGIN_MS > nowMs,
  );
}

/**
 * Server upload tokens are atomically consumed before the upload stream is
 * read. Once an upload request may have reached the server (including HTTP 5xx
 * responses), the token must be treated as consumed; only errors that
 * explicitly failed before sending the upload request (`requestSent: false`)
 * keep the cached token reusable.
 */
export function canReuseUploadTokenAfterError(error: unknown): boolean {
  return error instanceof LogUploadError && error.requestSent === false;
}

export function invalidateUploadTokenCacheAfterError(
  cache: ILogUploadTokenCache | undefined,
  error: unknown,
): ILogUploadTokenCache | undefined {
  if (!cache) {
    return undefined;
  }
  if (canReuseUploadTokenAfterError(error)) {
    return cache;
  }
  cache.consumed = true;
  return undefined;
}

export function isSniTimeoutErrorCode(code: string): boolean {
  return SNI_TIMEOUT_ERROR_CODES.has(code);
}

export function isSniPreWriteUploadErrorCode(code: string): boolean {
  return SNI_PRE_WRITE_UPLOAD_ERROR_CODES.has(code);
}

/**
 * Retry only failures that are cheap to repeat and may succeed next time.
 * Timeouts, HTTP 4xx and server business errors (e.g. rate limiting on the
 * token endpoint) are terminal; HTTP 5xx and other transport errors stay
 * retryable so transient upstream failures get one retry.
 */
export function isRetryableLogUploadError(error: unknown): boolean {
  if (error instanceof LogUploadError) {
    if (typeof error.retryable === 'boolean') {
      return error.retryable;
    }
    if (error.reason === 'network') {
      return true;
    }
    return (
      error.reason === 'http' &&
      typeof error.httpStatus === 'number' &&
      error.httpStatus >= 500 &&
      error.httpStatus < 600
    );
  }
  const candidate = error as
    | {
        className?: unknown;
        code?: unknown;
        httpStatusCode?: unknown;
        status?: unknown;
        response?: { status?: unknown };
      }
    | undefined;
  const rawStatus =
    candidate?.httpStatusCode ??
    candidate?.response?.status ??
    candidate?.status;
  const httpStatus =
    typeof rawStatus === 'number' && Number.isFinite(rawStatus)
      ? rawStatus
      : undefined;
  if (httpStatus !== undefined) {
    if (httpStatus >= 500 && httpStatus < 600) {
      return true;
    }
    if (httpStatus >= 400 && httpStatus < 500) {
      return false;
    }
  }
  // Errors crossing the background bridge may lose their prototype.
  if (candidate?.className === EOneKeyErrorClassNames.OneKeyServerApiError) {
    return (
      typeof candidate.code === 'number' &&
      candidate.code >= 500 &&
      candidate.code < 600 &&
      httpStatus === undefined
    );
  }
  return true;
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
