import { Mutex } from 'async-mutex';

import { getViewingKeyFingerprint } from '../../localWallet/viewingKeyFingerprint';

// Operations journaled before this belong to an earlier process that died
// mid-way; later ones are still running in this one.
export const ZCASH_PROCESS_STARTED_AT = Date.now();

// Keyed by viewing key fingerprint, so aliases of one UFVK share a mutex and
// the key itself is not held here.
const lifecycleMutexByVkFp = new Map<string, Mutex>();
const privacyModeOperationMutexByAccount = new Map<string, Mutex>();

export function getZcashLifecycleMutex(vkFpOrAccountId: string): Mutex {
  let mutex = lifecycleMutexByVkFp.get(vkFpOrAccountId);
  if (!mutex) {
    mutex = new Mutex();
    lifecycleMutexByVkFp.set(vkFpOrAccountId, mutex);
  }
  return mutex;
}

export function getZcashAccountLifecycleMutex({
  networkId,
  ufvk,
}: {
  networkId: string;
  ufvk: string;
}): Mutex {
  return getZcashLifecycleMutex(
    getViewingKeyFingerprint({ networkId, viewingKey: ufvk }),
  );
}

// Bounds the map: an idle mutex is made again on next use. Never one held or
// awaited, or a later caller would get a second mutex for the same identity;
// every caller locks right after the lookup, with no await in between.
export function forgetIdleZcashLifecycleMutexes(): void {
  for (const [key, mutex] of lifecycleMutexByVkFp) {
    if (!mutex.isLocked()) {
      lifecycleMutexByVkFp.delete(key);
    }
  }
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
