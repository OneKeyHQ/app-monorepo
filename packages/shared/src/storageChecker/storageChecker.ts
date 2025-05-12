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

const diskFullErrorMessage = `Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing`;

function handleDiskFullError(error: unknown) {
  const err = error as Error | undefined;
  if (err && err?.message && err?.message.includes(diskFullErrorMessage)) {
    globalThis.$onekeySystemDiskIsFull = true;
    appGlobals?.$appEventBus?.emit(
      EAppEventBusNames.ShowSystemDiskFullWarning,
      undefined,
    );
  }
}

function checkIfDiskIsFullSync() {
  if (globalThis.$onekeySystemDiskIsFull) {
    appGlobals?.$appEventBus?.emit(
      EAppEventBusNames.ShowSystemDiskFullWarning,
      undefined,
    );
    throw new SystemDiskFullError();
  }
}
async function checkIfDiskIsFull() {
  checkIfDiskIsFullSync();

  try {
    if (platformEnv.isExtension || platformEnv.isDesktop) {
      if (globalThis?.navigator?.storage?.estimate) {
        const estimate = await globalThis.navigator.storage.estimate();
        if (estimate && (estimate.quota || 0) > 1000) {
          const quotaInGB = (estimate.quota || 0) / 1024 / 1024 / 1024;
          const usageInGB = (estimate.usage || 0) / 1024 / 1024 / 1024;
          const availableInGB = quotaInGB - usageInGB;
          console.log('checkIfDiskIsFull', {
            quotaInGB,
            usageInGB,
            availableInGB,
          });
          if (availableInGB < 0.936) {
            globalThis.$onekeySystemDiskIsFull = true;
          }
        }
      }
    }
  } catch (error) {
    console.error('checkIfDiskIsFull', error);
  }

  checkIfDiskIsFullSync();
}
const checkIfDiskIsFullDebounced = debounce(checkIfDiskIsFull, 1000, {
  leading: false,
  trailing: true,
});
export default {
  handleDiskFullError,
  checkIfDiskIsFull,
  checkIfDiskIsFullSync,
  checkIfDiskIsFullDebounced,
};
