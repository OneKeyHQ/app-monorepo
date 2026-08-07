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

/** Most recent successful measurement, regardless of the current flag state. */
let lastQuotaInfo: IStorageQuotaInfo | undefined;
/** Why the guard is currently raised; `undefined` while storage is healthy. */
let lastDiagnostics: IStorageFullDiagnostics | undefined;
let hasLoggedFirstMeasurement = false;

function getErrorMessage(error: unknown): string | undefined {
  return (error as Error | undefined)?.message;
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
  if (!wasAlreadyFull) {
    appGlobals?.$defaultLogger?.app.storage.diskFullDetected(diagnostics);
  }
  emitWarning(diagnostics);
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
  const errorMessage = getErrorMessage(error);
  if (!errorMessage) {
    return;
  }
  if (!diskFullErrorMessages.some((message) => errorMessage.includes(message))) {
    return;
  }
  raiseDiskFull({
    reason: EStorageFullReason.WriteFailed,
    errorMessage,
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
          } else {
            clearDiskFull(quotaInfo);
          }
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
