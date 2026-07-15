import { EOneKeyErrorClassNames } from '../errors/types/errorTypes';
import errorUtils from '../errors/utils/errorUtils';

// Detect transient infrastructure failures (network down, 5xx, timeout, rate
// limit) as opposed to definite auth/business rejections. Relies only on
// fields that survive bg -> main bridge serialization (className / code /
// httpStatusCode) instead of instanceof checks, so the same classification
// works identically in both runtimes.
export function isTransientNetworkLikeError(error: unknown): boolean {
  if (
    errorUtils.isErrorByClassName({
      error,
      className: EOneKeyErrorClassNames.AxiosNetworkError,
    })
  ) {
    return true;
  }
  const httpStatusCode = (error as { httpStatusCode?: number } | undefined)
    ?.httpStatusCode;
  if (typeof httpStatusCode === 'number') {
    // Allowlist of HTTP statuses that represent transient infrastructure
    // failures. Anything else — e.g. 401 / 403 / 422, or 2xx responses with
    // a non-zero business code — is a real rejection.
    if (
      (httpStatusCode >= 500 && httpStatusCode < 600) ||
      httpStatusCode === 408 ||
      httpStatusCode === 429
    ) {
      return true;
    }
  }
  // Axios timeout / DNS / connection errors that the interceptor does not
  // rewrap (e.g. ECONNABORTED, ETIMEDOUT, ENOTFOUND) bubble up as raw
  // AxiosError. Match by `.code` so we don't depend on locale-sensitive
  // `.message` strings.
  const errorCode = (error as { code?: string | number } | undefined)?.code;
  if (typeof errorCode === 'string') {
    if (
      errorCode === 'ECONNABORTED' ||
      errorCode === 'ETIMEDOUT' ||
      errorCode === 'ECONNRESET' ||
      errorCode === 'ECONNREFUSED' ||
      errorCode === 'ENOTFOUND' ||
      errorCode === 'ERR_NETWORK'
    ) {
      return true;
    }
  }
  return false;
}
