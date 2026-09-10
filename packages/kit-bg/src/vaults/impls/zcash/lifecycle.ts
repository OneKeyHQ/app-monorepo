import { Mutex } from 'async-mutex';

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
