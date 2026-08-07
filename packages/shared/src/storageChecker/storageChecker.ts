/*
    (await navigator.storage.estimate()).quota/1024/1024/1024 + ' GB'
        - web: 276 GB
        - ext: 38 GB
    chrome.system.storage.getInfo()
*/

import { debounce } from 'lodash';

import appGlobals from '../appGlobals';
import { SystemDiskFullError } from '../errors';
import { EAppEventBusNames } from '../eventBus/appEventBusNames';
import platformEnv from '../platformEnv';
import resetUtils from '../utils/resetUtils';

import { EStorageFullReason } from './types';

import type { IStorageFullDiagnostics, IStorageQuotaInfo } from './types';

/**
 * Messages IndexedDB uses when the backing store genuinely has no room left.
 *
 * `The database connection is closing` is deliberately NOT here. That is an
 * `InvalidStateError` from the connection lifecycle (a `versionchange` raised
 * by another runtime, a browser-forced close, storage bucket eviction) and
 * says nothing about free space. Treating it as disk-full latched the whole
 * runtime into a permanent false alarm on machines with tens of GB free.
 * `IndexedDBPromised` now recovers from it by reopening the connection.
 */
const diskFullErrorMessages = [
  'QuotaExceededError',
  'Encountered disk full',
  'Encountered full disk',
];

const connectionClosingErrorMessage = `The database connection is closing`;

const warningAtGB = 0.936;
// const warningAtGB = 1110.936;
const warningAtBytes = warningAtGB * 1024 * 1024 * 1024;
/**
 * Fraction of the granted quota to fall back on when the quota is too small
 * for the fixed floor to make sense.
 */
const warningQuotaRatio = 0.1;

/**
 * Headroom below which the guard is raised.
 *
 * The fixed floor was calibrated against extension-sized quotas (tens of GB).
 * Applied verbatim to a browser that grants an origin less than that, it would
 * mark an almost-empty origin as full and never let it recover. Taking the
 * smaller of the floor and a fraction of the quota keeps the threshold both
 * proportional and continuous: quotas at or above ~9.4 GB are unaffected.
 */
function getWarningAtBytes(quotaBytes: number): number {
  return Math.min(warningAtBytes, quotaBytes * warningQuotaRatio);
}

/**
 * Headroom needed to release the guard again. The gap against the warning
 * threshold is deliberate: the measurement re-runs on every write (debounced
 * to 1s), so a quota sitting near the threshold would otherwise flip the guard
 * — and with it the warning dialog and a log line — once per second in both
 * directions.
 *
 * The band must stay reachable: `availableBytes` can never exceed the quota,
 * so a fixed 2× threshold would latch the guard forever on a small quota. This
 * returns 2× the warning threshold when the quota affords it, and otherwise
 * the midpoint between that threshold and the quota itself.
 */
function getClearAtBytes(quotaBytes: number): number {
  const warnAtBytes = getWarningAtBytes(quotaBytes);
  const reachableHeadroom = Math.max(0, (quotaBytes - warnAtBytes) / 2);
  return warnAtBytes + Math.min(warnAtBytes, reachableHeadroom);
}

/** Most recent successful measurement, regardless of the current flag state. */
let lastQuotaInfo: IStorageQuotaInfo | undefined;
/** Why the guard is currently raised; `undefined` while storage is healthy. */
let lastDiagnostics: IStorageFullDiagnostics | undefined;
let hasLoggedFirstMeasurement = false;

function getErrorMessage(error: unknown): string | undefined {
  return (error as Error | undefined)?.message;
}

/**
 * `name` + `message` combined. A standard quota failure is a `DOMException`
 * whose `name` is `QuotaExceededError` while its `message` is often just
 * "The quota has been exceeded." — matching on the message alone misses it.
 */
function getErrorText(error: unknown): string {
  const err = error as Partial<DOMException> | undefined;
  const name = typeof err?.name === 'string' ? err.name : '';
  const message = typeof err?.message === 'string' ? err.message : '';
  return [name, message].filter(Boolean).join(': ');
}

/**
 * A dead cached `IDBDatabase` handle, not a storage-space problem. Exposed so
 * `IndexedDBPromised` can drop the handle and reopen instead of surfacing it
 * to the user as "disk is full".
 */
function isConnectionClosingError(error: unknown): boolean {
  return (
    getErrorMessage(error)?.includes(connectionClosingErrorMessage) ?? false
  );
}

function getLastDiagnostics(): IStorageFullDiagnostics | undefined {
  return lastDiagnostics;
}

function emitWarning(diagnostics: IStorageFullDiagnostics | undefined) {
  appGlobals?.$appEventBus?.emit(
    EAppEventBusNames.ShowSystemDiskFullWarning,
    diagnostics,
  );
}

function raiseDiskFull(diagnostics: IStorageFullDiagnostics) {
  const wasAlreadyFull = Boolean(globalThis.$onekeySystemDiskIsFull);
  globalThis.$onekeySystemDiskIsFull = true;
  lastDiagnostics = diagnostics;
  // Log and warn on the transition only. While the guard stays raised the
  // debounced measurement re-runs on every write, and each blocked write
  // already re-emits the warning via `checkIfDiskIsFullSync`.
  if (!wasAlreadyFull) {
    appGlobals?.$defaultLogger?.app.storage.diskFullDetected(diagnostics);
    emitWarning(diagnostics);
  }
}

/**
 * Release the guard once measured headroom recovers. Without this the flag was
 * write-once for the lifetime of the runtime, so a single transient false
 * positive kept every later write and delete failing until the user happened
 * to restart the extension background.
 */
function clearDiskFull(quotaInfo: IStorageQuotaInfo) {
  if (!globalThis.$onekeySystemDiskIsFull) {
    lastDiagnostics = undefined;
    return;
  }
  globalThis.$onekeySystemDiskIsFull = undefined;
  lastDiagnostics = undefined;
  appGlobals?.$defaultLogger?.app.storage.diskFullCleared(quotaInfo);
}

function handleDiskFullError(error: unknown) {
  if (platformEnv.isWebDappMode) {
    return;
  }
  const errorText = getErrorText(error);
  if (!errorText) {
    return;
  }
  if (!diskFullErrorMessages.some((message) => errorText.includes(message))) {
    return;
  }
  raiseDiskFull({
    reason: EStorageFullReason.WriteFailed,
    errorMessage: errorText,
    quotaInfo: lastQuotaInfo,
  });
}

// Declared before its first use in `checkIfDiskIsFullSync`; `checkIfDiskIsFull`
// itself is a hoisted function declaration.
const checkIfDiskIsFullDebounced = debounce(checkIfDiskIsFull, 1000, {
  leading: false,
  trailing: true,
  // Without maxWait, sustained write traffic (every blocked write schedules
  // this) would push the timer forward indefinitely and the measurement would
  // never run — starving the very recovery path that clears the guard.
  maxWait: 1000,
});

function checkIfDiskIsFullSync() {
  if (platformEnv.isWebDappMode) {
    return;
  }
  // App reset wipes storage to free space. Blocking it would close off the
  // only recovery path a user has when storage really is exhausted.
  if (resetUtils.getIsResetting()) {
    return;
  }
  if (globalThis.$onekeySystemDiskIsFull) {
    // Schedule a re-measurement before rejecting. A blocked write never
    // reaches the IndexedDB shim that normally schedules it, so without this
    // the guard could never observe the user freeing space and would stay
    // latched until the runtime restarts — the sticky failure this whole
    // change set exists to remove.
    void checkIfDiskIsFullDebounced();
    emitWarning(lastDiagnostics);
    throw new SystemDiskFullError();
  }
}

/**
 * Measure current headroom and update the guard. Intentionally never throws:
 * it is the only path that can *clear* the flag, so it must keep running after
 * the guard is already raised.
 */
async function checkIfDiskIsFull() {
  if (platformEnv.isWebDappMode) {
    return;
  }

  try {
    // Every runtime that persists through the browser quota must be able to
    // clear its own guard. Web DApp mode already returned above.
    if (platformEnv.isExtension || platformEnv.isDesktop || platformEnv.isWeb) {
      if (globalThis?.navigator?.storage?.estimate) {
        const estimate = await globalThis.navigator.storage.estimate();
        if (estimate && (estimate.quota || 0) > 1000) {
          const quotaBytes = estimate.quota || 0;
          const usageBytes = estimate.usage || 0;
          const quotaInfo: IStorageQuotaInfo = {
            quotaBytes,
            usageBytes,
            availableBytes: quotaBytes - usageBytes,
          };
          lastQuotaInfo = quotaInfo;
          if (!hasLoggedFirstMeasurement) {
            hasLoggedFirstMeasurement = true;
            appGlobals?.$defaultLogger?.app.storage.quotaMeasured(quotaInfo);
          }
          if (quotaInfo.availableBytes < getWarningAtBytes(quotaBytes)) {
            raiseDiskFull({
              reason: EStorageFullReason.QuotaExhausted,
              quotaInfo,
            });
          } else if (quotaInfo.availableBytes >= getClearAtBytes(quotaBytes)) {
            clearDiskFull(quotaInfo);
          }
          // Between the two thresholds: keep the current state either way.
        }
      }
    }
  } catch (error) {
    console.error('checkIfDiskIsFull', error);
  }
}

export default {
  handleDiskFullError,
  isConnectionClosingError,
  getLastDiagnostics,
  checkIfDiskIsFull,
  checkIfDiskIsFullSync,
  checkIfDiskIsFullDebounced,
};
