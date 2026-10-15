import { Mutex } from 'async-mutex';

// Operations journaled before this belong to an earlier process that died
// mid-way; later ones are still running in this one.
export const ZCASH_PROCESS_STARTED_AT = Date.now();

const lifecycleMutexByViewingKey = new Map<string, Mutex>();
const privacyModeOperationMutexByAccount = new Map<string, Mutex>();

export function getZcashLifecycleMutex(viewingKeyOrAccountId: string): Mutex {
  let mutex = lifecycleMutexByViewingKey.get(viewingKeyOrAccountId);
  if (!mutex) {
    mutex = new Mutex();
    lifecycleMutexByViewingKey.set(viewingKeyOrAccountId, mutex);
  }
  return mutex;
}

export function getZcashPrivacyModeOperationMutex(accountId: string): Mutex {
  let mutex = privacyModeOperationMutexByAccount.get(accountId);
  if (!mutex) {
    mutex = new Mutex();
    privacyModeOperationMutexByAccount.set(accountId, mutex);
  }
  return mutex;
}

const syncMutexByNetwork = new Map<string, Mutex>();

export function getZcashSyncMutex(network: string): Mutex {
  let mutex = syncMutexByNetwork.get(network);
  if (!mutex) {
    mutex = new Mutex();
    syncMutexByNetwork.set(network, mutex);
  }
  return mutex;
}
