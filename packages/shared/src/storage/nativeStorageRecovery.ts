import type {
  INativeAppStorageEmergencyStatus,
  INativeStorageMigrationRecoveryTarget,
} from './nativeStorageTypes';

let emergencyStatus: INativeAppStorageEmergencyStatus | undefined;
const emergencyListeners = new Set<() => void>();
export function getNativeAppStorageEmergencyStatus() {
  return emergencyStatus;
}
export function subscribeNativeAppStorageEmergencyStatus(listener: () => void) {
  emergencyListeners.add(listener);
  return () => {
    emergencyListeners.delete(listener);
  };
}
export function setNativeAppStorageEmergencyStatus(
  status: INativeAppStorageEmergencyStatus | undefined,
) {
  const next =
    status?.mode === 'emergency' && status.phase === 'active'
      ? status
      : undefined;
  if (emergencyStatus?.epoch === next?.epoch) return;
  emergencyStatus = next;
  emergencyListeners.forEach((listener) => listener());
}

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
