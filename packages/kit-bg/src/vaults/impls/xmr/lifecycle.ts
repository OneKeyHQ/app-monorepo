import { Mutex } from 'async-mutex';

// bg owns lifecycle ordering; the Worker owns the shared database.
const lifecycleMutexes = new Map<string, Mutex>();

export function getXmrLifecycleMutex(networkId: string): Mutex {
  let mutex = lifecycleMutexes.get(networkId);
  if (!mutex) {
    mutex = new Mutex();
    lifecycleMutexes.set(networkId, mutex);
  }
  return mutex;
}
