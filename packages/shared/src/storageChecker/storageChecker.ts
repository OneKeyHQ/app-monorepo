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
 * Headroom needed to release the guard again. The gap against `warningAtBytes`
 * is deliberate: the measurement re-runs on every write (debounced to 1s), so
 * a quota sitting near the threshold would otherwise flip the guard — and with
 * it the warning dialog and a log line — once per second in both directions.
 *
 * The band must stay reachable: `availableBytes` can never exceed the quota,
 * so on a small quota a fixed 2× threshold would latch the guard forever. For
 * large quotas this returns 2× the warning floor; for small ones it shrinks to
 * the midpoint between the warning floor and the quota itself. A quota at or
 * below the warning floor keeps the guard latched — storage that small cannot
 * hold the app's data anyway.
 */
function getClearAtBytes(quotaBytes: number): number {
  const reachableHeadroom = Math.max(0, (quotaBytes - warningAtBytes) / 2);
  return warningAtBytes + Math.min(warningAtBytes, reachableHeadroom);
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
    if (platformEnv.isExtension || platformEnv.isDesktop) {
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
          if (quotaInfo.availableBytes < warningAtBytes) {
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

const checkIfDiskIsFullDebounced = debounce(checkIfDiskIsFull, 1000, {
  leading: false,
  trailing: true,
});
export default {
  handleDiskFullError,
  isConnectionClosingError,
  getLastDiagnostics,
  checkIfDiskIsFull,
  checkIfDiskIsFullSync,
  checkIfDiskIsFullDebounced,
};
