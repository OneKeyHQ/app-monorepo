import { globalNetInfo } from '@onekeyhq/components/src/hooks/useNetInfo';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import {
  extractUpdateErrorCode,
  isUnrecoverableDownloadError,
} from './updateErrorTaxonomy';

const DOWNLOAD_RETRY_MAX_ATTEMPTS = 5;
const DOWNLOAD_RETRY_BASE_DELAY_MS = 1500;
const DOWNLOAD_RETRY_MAX_DELAY_MS = 60_000;
// Cap on how long we'll camp on the NetInfo listener before falling back to
// the regular backoff. 5 minutes is long enough to cover Wi-Fi → cellular
// handover, captive-portal re-auth, and most train-tunnel blackouts without
// leaving the retry loop wedged forever on a user who just put the phone down.
const DOWNLOAD_RETRY_OFFLINE_WAIT_MS = 5 * 60 * 1000;
// Brief grace after the network is reported back so we don't fire the next
// request while the OS is still negotiating DNS / probing the captive portal.
const DOWNLOAD_RETRY_ONLINE_GRACE_MS = 1500;

// Visible for testing; main callers go through runDownloadWithRetry.
export function computeDownloadRetryDelayMs(attempt: number): number {
  const exp =
    DOWNLOAD_RETRY_BASE_DELAY_MS * 2 ** attempt +
    Math.floor(Math.random() * 500);
  return Math.min(exp, DOWNLOAD_RETRY_MAX_DELAY_MS);
}

/**
 * Wait until either `timeoutMs` elapses OR globalNetInfo reports the device
 * is online (isInternetReachable !== false), whichever comes first. The
 * `null` (unknown) state is treated as "not offline" — we never block on a
 * NetInfo that hasn't booted yet, since blocking on `null` would wedge the
 * retry loop on environments where the reachability probe never runs.
 */
async function waitForOnlineOrTimeout(
  timeoutMs: number,
  context: string,
): Promise<void> {
  if (globalNetInfo.currentState().isInternetReachable !== false) return;
  const startedAt = Date.now();
  defaultLogger.app.appUpdate.log(
    `${context}: offline-wait start, cap=${timeoutMs}ms`,
  );
  // Default to 'timeout'; only the listener path overrides to 'online'.
  let exitReason: 'online' | 'timeout' = 'timeout';
  await new Promise<void>((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: (() => void) | null = null;
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
      unsubscribe?.();
      resolve();
    };
    timeoutId = setTimeout(finish, timeoutMs);
    unsubscribe = globalNetInfo.addEventListener((state) => {
      if (state.isInternetReachable !== false) {
        exitReason = 'online';
        finish();
      }
    });
  });
  defaultLogger.app.appUpdate.log(
    `${context}: offline-wait end reason=${exitReason} elapsed=${
      Date.now() - startedAt
    }ms`,
  );
}

/**
 * Sleep before the next attempt. When the device is currently reported
 * offline, prefer "wait until online" over a fixed exponential delay —
 * a 1.5s backoff in a 30s tunnel just burns retries against DNS for nothing.
 * When the device is online, fall back to the original
 * exp + jitter schedule capped at DOWNLOAD_RETRY_MAX_DELAY_MS.
 */
async function waitBeforeRetry(
  attempt: number,
  context: string,
): Promise<void> {
  const baseDelay = computeDownloadRetryDelayMs(attempt);
  if (globalNetInfo.currentState().isInternetReachable === false) {
    await waitForOnlineOrTimeout(DOWNLOAD_RETRY_OFFLINE_WAIT_MS, context);
    // After the listener fires (or the offline cap expires), give the OS a
    // moment to stabilize the new path before we hammer the CDN again.
    await timerUtils.wait(Math.min(baseDelay, DOWNLOAD_RETRY_ONLINE_GRACE_MS));
    return;
  }
  await timerUtils.wait(baseDelay);
}

/**
 * Retries `operation` on transient bundle / APK download failures (network
 * drops, partial truncation, transient server 5xx) up to
 * DOWNLOAD_RETRY_MAX_ATTEMPTS times. The native modules persist their
 * resume artifact (iOS .resume / Android & Desktop .partial) on each failure,
 * so each retry is a true range-resume rather than a from-byte-zero re-fetch.
 *
 * Wait strategy is reachability-aware: while NetInfo reports offline we camp
 * on its listener (capped by DOWNLOAD_RETRY_OFFLINE_WAIT_MS) and only release
 * once the link comes back; when online we use exponential backoff
 * (`1500 * 2^attempt + jitter[0,500)`, capped at DOWNLOAD_RETRY_MAX_DELAY_MS).
 *
 * Bails immediately for unrecoverable codes (SHA mismatch, HTTP 403/404/410,
 * config errors) so we don't waste backoff windows on deterministic dead
 * states.
 */
export async function runDownloadWithRetry<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T> {
  for (let attempt = 0; attempt <= DOWNLOAD_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (e) {
      if (
        isUnrecoverableDownloadError(e) ||
        attempt === DOWNLOAD_RETRY_MAX_ATTEMPTS
      ) {
        throw e;
      }
      const isOffline =
        globalNetInfo.currentState().isInternetReachable === false;
      const baseDelayMs = computeDownloadRetryDelayMs(attempt);
      defaultLogger.app.appUpdate.log(
        `${context}: retry ${attempt + 1}/${DOWNLOAD_RETRY_MAX_ATTEMPTS} ${
          isOffline
            ? `offline-wait≤${DOWNLOAD_RETRY_OFFLINE_WAIT_MS}ms`
            : `in ${baseDelayMs}ms`
        } — code=${extractUpdateErrorCode(e) ?? '<none>'}`,
      );
      await waitBeforeRetry(attempt, context);
    }
  }
  // Unreachable: the loop either returns on success or throws on the
  // attempt === MAX iteration. Keep the throw to satisfy TS control flow.
  throw new OneKeyLocalError('runDownloadWithRetry: unreachable');
}
