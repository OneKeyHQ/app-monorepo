// cspell:ignore OCDS
import { globalNetInfo } from '@onekeyhq/components/src/hooks/useNetInfo';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import {
  extractUpdateErrorCode,
  isPermanentThisUrlDownloadError,
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
 * OCDS v1.1 §5.11 — definitive terminal "gave up" outcome. Thrown when the
 * persisted cross-restart attempt budget or the overall wall-clock deadline is
 * exhausted, OR when a single-stream fallback failure is treated as the
 * download's terminal failure. Distinct from the underlying transport error so
 * the caller can surface "we have stopped retrying" rather than a transient
 * network blip.
 */
export type IDownloadGaveUpReason =
  | 'maxAttempts'
  | 'deadline'
  | 'fallbackFailed'
  | 'urlDead';

export class DownloadGaveUpError extends OneKeyLocalError {
  // Why we gave up — surfaced for analytics / UI copy. (`name` stays the
  // OneKeyLocalError className; callers discriminate via `instanceof
  // DownloadGaveUpError` + this field.)
  readonly reason: IDownloadGaveUpReason;

  // The last underlying transport error, when there was one.
  readonly downloadCause?: unknown;

  constructor(params: {
    reason: IDownloadGaveUpReason;
    message?: string;
    cause?: unknown;
  }) {
    super(params.message ?? `DownloadGaveUp: ${params.reason}`);
    this.reason = params.reason;
    this.downloadCause = params.cause;
  }
}

/**
 * Per-target persisted-budget hooks (OCDS §5.11). Owned by ServiceAppUpdate
 * (kit-bg) and injected here so this module stays pure / unit-testable. When a
 * caller does not supply them, the loop runs with the legacy in-memory bound
 * only (no cross-restart persistence) — used by existing tests.
 */
export interface IDownloadRetryBudgetResult {
  givenUp: boolean;
  reason?: 'maxAttempts' | 'deadline';
}
export interface IDownloadRetryOptions {
  // Read the persisted budget WITHOUT mutating it (checked on entry).
  getBudget?: () => Promise<IDownloadRetryBudgetResult>;
  // Increment + persist the attempt counter; returns the post-increment state.
  recordAttempt?: () => Promise<IDownloadRetryBudgetResult>;
  // Clear the persisted budget (on success).
  resetBudget?: () => Promise<void>;
  // OCDS §4 — obtain a fresh signed URL after a 401/403 (permanent-this-URL).
  // Returns true if a fresh URL is now available to retry against, false if
  // the URL could not be refreshed (→ terminal). Called at most once.
  refreshUrl?: () => Promise<boolean>;
  // OCDS §5.11 — classify whether a terminal transport error came from the
  // single-stream fallback path (the native downloader having already given up
  // on concurrency and fallen back). When this returns true for the error that
  // ends the run, "fallback failure is the terminal failure of the whole
  // download": the loop surfaces DownloadGaveUpError('fallbackFailed') instead
  // of the raw transport error, so the fallback is never a silent black hole.
  // Defaults (when absent) to isSingleStreamFallbackFailure below.
  isFallbackFailure?: (error: unknown) => boolean;
}

/**
 * OCDS §5.11 default detector for "the single-stream fallback itself failed".
 * The native range downloader emits a `fallback` signal and then runs the
 * sequential single-stream path; when THAT path also fails it surfaces the
 * error with a recognizable marker. Recognizing it here lets runDownloadWithRetry
 * tag the run's terminal outcome as 'fallbackFailed' rather than leaking a bare
 * transport error, making §5.11's "fallback is not a black hole" observable to
 * the caller (analytics / UI copy).
 */
export function isSingleStreamFallbackFailure(error: unknown): boolean {
  const msg = (error as { message?: string } | null)?.message ?? '';
  const code = (error as { code?: string } | null)?.code ?? '';
  return (
    /\bfallback\b/i.test(msg) ||
    /single[-\s]?stream/i.test(msg) ||
    code === 'FALLBACK_FAILED' ||
    code === 'SINGLE_STREAM_FAILED'
  );
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
 * Bails immediately for unrecoverable codes (SHA mismatch, HTTP
 * 401/403/404/410/501/505, config errors) so we don't waste backoff windows on
 * deterministic dead states.
 *
 * OCDS v1.1 §5.11 termination contract (active only when `options` carries the
 * persisted-budget hooks — kit-bg's ServiceAppUpdate provides them):
 *   - On entry, if the persisted cross-restart budget is already exhausted the
 *     download is terminal immediately (no in-memory retry budget re-spend).
 *   - Each attempt increments the persisted counter; when the counter or the
 *     wall-clock deadline trips, the loop ends with a DownloadGaveUpError.
 *   - A 401/403 (permanent-this-URL) triggers a single bounded URL refresh and
 *     one more attempt against the freshly-signed URL before going terminal.
 *   - On success the persisted budget is reset.
 */
export async function runDownloadWithRetry<T>(
  operation: () => Promise<T>,
  context: string,
  options?: IDownloadRetryOptions,
): Promise<T> {
  // §5.11 entry guard: a target that already exhausted its budget on a prior
  // launch is terminal before we spend a single in-memory attempt.
  if (options?.getBudget) {
    const entry = await options.getBudget();
    if (entry.givenUp) {
      defaultLogger.app.appUpdate.log(
        `${context}: persisted budget already exhausted on entry reason=${
          entry.reason ?? ''
        } — terminal`,
      );
      throw new DownloadGaveUpError({
        reason: entry.reason ?? 'maxAttempts',
        message: `${context}: download gave up (persisted ${
          entry.reason ?? 'maxAttempts'
        })`,
      });
    }
  }

  // Tracks whether we've already spent the one-shot 401/403 URL refresh.
  let urlRefreshed = false;

  for (let attempt = 0; attempt <= DOWNLOAD_RETRY_MAX_ATTEMPTS; attempt += 1) {
    // §5.11 — record this attempt in durable storage BEFORE running it so a
    // crash mid-attempt still counts toward the budget on the next launch.
    if (options?.recordAttempt) {
      // eslint-disable-next-line no-await-in-loop
      const budget = await options.recordAttempt();
      if (budget.givenUp) {
        defaultLogger.app.appUpdate.log(
          `${context}: persisted budget exhausted reason=${
            budget.reason ?? ''
          } — terminal`,
        );
        throw new DownloadGaveUpError({
          reason: budget.reason ?? 'maxAttempts',
          message: `${context}: download gave up (persisted ${
            budget.reason ?? 'maxAttempts'
          })`,
        });
      }
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await operation();
      // §5.11 — success clears the persisted budget so the next target starts
      // fresh and a stale give-up never lingers.
      if (options?.resetBudget) {
        // eslint-disable-next-line no-await-in-loop
        await options.resetBudget().catch(() => undefined);
      }
      return result;
    } catch (e) {
      // §4 — a 401/403 (permanent-this-URL) is not a blind retry: refresh the
      // signed URL ONCE and try again against the fresh one. If the refresh
      // yields no fresh URL, the URL is dead → terminal.
      if (
        isPermanentThisUrlDownloadError(e) &&
        options?.refreshUrl &&
        !urlRefreshed &&
        attempt < DOWNLOAD_RETRY_MAX_ATTEMPTS
      ) {
        urlRefreshed = true;
        defaultLogger.app.appUpdate.log(
          `${context}: 401/403 permanent-this-url — refreshing signed URL`,
        );
        // eslint-disable-next-line no-await-in-loop
        const ok = await options.refreshUrl().catch(() => false);
        if (!ok) {
          throw new DownloadGaveUpError({
            reason: 'urlDead',
            message: `${context}: signed URL could not be refreshed`,
            cause: e,
          });
        }
        // Retry immediately against the fresh URL (no backoff: this is not a
        // transient network failure, the prior URL was simply expired).
        // eslint-disable-next-line no-continue
        continue;
      }
      if (
        isUnrecoverableDownloadError(e) ||
        attempt === DOWNLOAD_RETRY_MAX_ATTEMPTS
      ) {
        // §5.11 — if the error that ends the run came from the single-stream
        // fallback path, the fallback itself failed, which IS the terminal
        // failure of the whole download. Surface it as a definitive give-up
        // ('fallbackFailed') rather than leaking the bare transport error, so
        // the fallback is never a silent black hole.
        const detectFallback = options?.isFallbackFailure
          ? options.isFallbackFailure
          : isSingleStreamFallbackFailure;
        if (detectFallback(e)) {
          defaultLogger.app.appUpdate.log(
            `${context}: single-stream fallback failed — terminal (fallbackFailed) code=${
              extractUpdateErrorCode(e) ?? '<none>'
            }`,
          );
          throw new DownloadGaveUpError({
            reason: 'fallbackFailed',
            message: `${context}: single-stream fallback failed`,
            cause: e,
          });
        }
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
      // eslint-disable-next-line no-await-in-loop
      await waitBeforeRetry(attempt, context);
    }
  }
  // Unreachable: the loop either returns on success or throws on the
  // attempt === MAX iteration. Keep the throw to satisfy TS control flow.
  throw new OneKeyLocalError('runDownloadWithRetry: unreachable');
}
