import type { INativeStorageMigrationRecoveryTarget } from './nativeStorageTypes';

let requestedTarget: INativeStorageMigrationRecoveryTarget | undefined;
let requestedTestSessionId: string | undefined;
const listeners = new Set<() => void>();

// This is UI-runtime state only. Storage mutations still go through bg RPC.
export function requestNativeStorageRecovery(
  target: INativeStorageMigrationRecoveryTarget,
  testSessionId?: string,
) {
  requestedTarget = target;
  requestedTestSessionId = target === 'appStorage' ? testSessionId : undefined;
  listeners.forEach((listener) => listener());
}

export function getRequestedNativeStorageRecovery() {
  return requestedTarget;
}

export function getRequestedNativeStorageRecoveryTestSessionId() {
  return requestedTestSessionId;
}

export function dismissNativeStorageRecovery() {
  requestedTarget = undefined;
  requestedTestSessionId = undefined;
  listeners.forEach((listener) => listener());
}

export function subscribeNativeStorageRecovery(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
