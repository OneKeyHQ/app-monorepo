import {
  annotateOnramperSdkErrorMessage,
  isStructuralOnramperError,
} from './utils';

import type { IOnramperError } from './type';

// Automatic recovery for the native buy page: which failures are worth another
// attempt before the user is asked, and how long to wait first. Numbers come
// from device logs (2026-10-30 / 2026-11-06, SDK 1.3.1): session mint 1.2-6.8 s,
// SDK initialize 4.2-8.9 s, a quote 0.7-4.3 s.

// A visible wait (init or quote) this long gets a "still working" line.
export const ONRAMPER_SLOW_HINT_MS = 8000;

// Back-off before init attempt 2 and 3.
const INIT_RETRY_DELAYS_MS = [1000, 2000];
// No attempt starts later than this after the first one began: a session mint
// that times out (10-16 s observed) must not be queued up three times over.
const INIT_RETRY_BUDGET_MS = 12_000;
const QUOTE_RETRY_DELAY_MS = 1000;

// Backend verdicts on the session or the device (SDK `BFFRecoveryError`) that
// a fresh session cannot change. `sdkSessionRejected` is the session having
// been minted under a key other than the one this build carries.
const PERMANENT_BFF_REJECTIONS = new Set([
  'configurationError',
  'sdkSessionRejected',
  'attestationRejected',
  'deviceBlocked',
]);
// "BFFRecoveryError.caseName" (SDK 1.3) or "BFFRecoveryError error N =
// caseName" (older text, once annotated).
const BFF_REJECTION_PATTERN = /BFFRecoveryError(?:\.| error \d+ = )([A-Za-z]+)/;

function isPermanentInitError(error: IOnramperError | undefined): boolean {
  if (isStructuralOnramperError(error)) {
    return true;
  }
  const rejection = BFF_REJECTION_PATTERN.exec(
    annotateOnramperSdkErrorMessage(error?.message ?? ''),
  )?.[1];
  return rejection !== undefined && PERMANENT_BFF_REJECTIONS.has(rejection);
}

// Delay before the next session mint + initialize attempt, or undefined when
// the failure should be shown. `attempt` is the 1-based attempt that just
// failed; `elapsedMs` counts from the start of the first attempt.
export function getOnramperInitRetryDelayMs({
  attempt,
  elapsedMs,
  error,
}: {
  attempt: number;
  elapsedMs: number;
  error: IOnramperError | undefined;
}): number | undefined {
  if (isPermanentInitError(error)) {
    return undefined;
  }
  const delayMs = INIT_RETRY_DELAYS_MS[attempt - 1];
  if (delayMs === undefined || elapsedMs + delayMs > INIT_RETRY_BUDGET_MS) {
    return undefined;
  }
  return delayMs;
}

// Quote failures that say nothing about the request itself. Everything else
// (no quote for this amount / region, an invalid or superseded request) would
// come back the same, so it goes straight to the user.
const TRANSIENT_QUOTE_ERROR_CODES = new Set([
  'temporaryFailure',
  'networkError',
  'timeout',
]);

// Delay before re-asking for the same quote, or undefined when the failure
// should be shown. One automatic retry at most.
export function getOnramperQuoteRetryDelayMs({
  attempt,
  error,
}: {
  attempt: number;
  error: IOnramperError | undefined;
}): number | undefined {
  if (attempt > 1 || !error?.code) {
    return undefined;
  }
  return TRANSIENT_QUOTE_ERROR_CODES.has(error.code)
    ? QUOTE_RETRY_DELAY_MS
    : undefined;
}
