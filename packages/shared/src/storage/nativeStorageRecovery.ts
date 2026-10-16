import type { INativeStorageMigrationRecoveryTarget } from './nativeStorageTypes';

let requestedTarget: INativeStorageMigrationRecoveryTarget | undefined;
const listeners = new Set<() => void>();

// This is UI-runtime state only. Storage mutations still go through bg RPC.
export function requestNativeStorageRecovery(
  target: INativeStorageMigrationRecoveryTarget,
) {
  requestedTarget = target;
  listeners.forEach((listener) => listener());
}

export function getRequestedNativeStorageRecovery() {
  return requestedTarget;
}

export function dismissNativeStorageRecovery() {
  requestedTarget = undefined;
  listeners.forEach((listener) => listener());
}

export function subscribeNativeStorageRecovery(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
