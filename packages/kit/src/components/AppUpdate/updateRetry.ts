import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import {
  extractUpdateErrorCode,
  isUnrecoverableDownloadError,
} from './updateErrorTaxonomy';

const DOWNLOAD_RETRY_MAX_ATTEMPTS = 3;
const DOWNLOAD_RETRY_BASE_DELAY_MS = 1500;

// Visible for testing; main callers go through runDownloadWithRetry.
export function computeDownloadRetryDelayMs(attempt: number): number {
  return (
    DOWNLOAD_RETRY_BASE_DELAY_MS * 2 ** attempt +
    Math.floor(Math.random() * 500)
  );
}

/**
 * Retries `operation` on transient bundle-update failures (network drops,
 * partial truncation, transient server 5xx) up to DOWNLOAD_RETRY_MAX_ATTEMPTS
 * times with exponential backoff + jitter. The native modules persist their
 * resume artifact (iOS .resume / Android & Desktop .partial) on each failure,
 * so each retry is a true range-resume rather than a from-byte-zero re-fetch.
 *
 * Bails immediately for unrecoverable codes (SHA mismatch, HTTP 403/404/410,
 * config errors) so we don't waste backoff windows on deterministic dead
 * states. Cap of 3 attempts (initial + 3 retries = 4 total round-trips).
 * Backoff schedule is `1500 * 2^attempt + jitter[0,500)`, i.e. roughly
 * 1.5s, 3s, 6s before the 4th attempt; total worst-case wall time
 * before bubbling up is ~10.5s + ~1.5s of jitter.
 */
export async function runDownloadWithRetry<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= DOWNLOAD_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (e) {
      lastError = e;
      if (
        isUnrecoverableDownloadError(e) ||
        attempt === DOWNLOAD_RETRY_MAX_ATTEMPTS
      ) {
        throw e;
      }
      const delayMs = computeDownloadRetryDelayMs(attempt);
      defaultLogger.app.appUpdate.log(
        `${context}: retry ${attempt + 1}/${DOWNLOAD_RETRY_MAX_ATTEMPTS} in ${delayMs}ms — code=${
          extractUpdateErrorCode(e) ?? '<none>'
        }`,
      );
      await timerUtils.wait(delayMs);
    }
  }
  throw new OneKeyLocalError(
    lastError instanceof Error ? lastError.message : String(lastError),
  );
}
