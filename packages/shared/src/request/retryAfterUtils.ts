import { isAxiosError } from 'axios';

import type { OneKeyServerApiError } from '../errors';

export function getRetryAfterOnError(
  error: unknown,
  minimumDelayMs: number,
  estimatedServerTime?: number,
) {
  const response = isAxiosError(error) ? error.response : undefined;
  const serverError = error as OneKeyServerApiError | undefined;
  const retryAfter =
    serverError?.retryAfter ?? response?.headers?.['retry-after'];
  const responseDate =
    serverError?.retryAfterResponseDate ?? response?.headers?.date;
  const parsedDate =
    typeof responseDate === 'string' ? Date.parse(responseDate) : NaN;
  const responseTime = Number.isFinite(parsedDate) ? parsedDate : undefined;
  const header = typeof retryAfter === 'string' ? retryAfter.trim() : '';
  const delay = /^\d+$/.test(header)
    ? Number(header) * 1000
    : Date.parse(header) - (responseTime ?? estimatedServerTime ?? Date.now());
  return {
    responseTime,
    delayMs: Number.isFinite(delay)
      ? Math.max(minimumDelayMs, delay)
      : minimumDelayMs,
  };
}
