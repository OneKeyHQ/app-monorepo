import { isAxiosError } from 'axios';

import type { OneKeyServerApiError } from '../errors';

export function getUnanchoredRetryDelayMs({
  absoluteAt,
  minimumDelayMs,
  maximumDelayMs,
}: {
  absoluteAt: number;
  minimumDelayMs: number;
  maximumDelayMs: number;
}) {
  // Use the wall clock only to bound a delay. The caller measures its passage
  // with a monotonic clock, so later time adjustments cannot release it early.
  return Math.min(
    maximumDelayMs,
    Math.max(minimumDelayMs, absoluteAt - Date.now()),
  );
}

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
  const isRelative = /^\d+$/.test(header);
  const parsedDeadline = isRelative ? NaN : Date.parse(header);
  const absoluteAt = Number.isFinite(parsedDeadline)
    ? parsedDeadline
    : undefined;
  const referenceTime = responseTime ?? estimatedServerTime;
  let delay = minimumDelayMs;
  if (isRelative) {
    delay = Number(header) * 1000;
  } else if (absoluteAt !== undefined && referenceTime !== undefined) {
    delay = absoluteAt - referenceTime;
  }
  return {
    responseTime,
    absoluteAt,
    delayMs: Number.isFinite(delay)
      ? Math.max(minimumDelayMs, delay)
      : minimumDelayMs,
  };
}
