import { createMMKV } from 'react-native-mmkv';

import type {
  IAppRecoveryTestFault,
  IAppResetMarker,
  IAppResetPrivacyCleanup,
} from './appResetState';

export const APP_RESET_CONTROL_NAME = 'onekey-app-reset-control';
const KEY = 'pending';
const PRIVACY_CLEANUP_KEY = 'privacy-chain-cleanup';

let store: ReturnType<typeof createMMKV> | undefined;

function getStore() {
  store ??= createMMKV({ id: APP_RESET_CONTROL_NAME });
  return store;
}

export async function readAppResetMarker(): Promise<
  IAppResetMarker | undefined
> {
  const marker = getStore().getString(KEY);
  return marker ? (JSON.parse(marker) as IAppResetMarker) : undefined;
}

export async function writeAppResetMarker(
  marker?: IAppResetMarker,
): Promise<void> {
  if (marker) {
    getStore().set(KEY, JSON.stringify(marker));
  } else {
    getStore().remove(KEY);
  }
}

export async function readAppResetPrivacyCleanup(): Promise<
  IAppResetPrivacyCleanup | undefined
> {
  const value = getStore().getString(PRIVACY_CLEANUP_KEY);
  return value ? (JSON.parse(value) as IAppResetPrivacyCleanup) : undefined;
}

export async function writeAppResetPrivacyCleanup(
  cleanup: IAppResetPrivacyCleanup,
): Promise<void> {
  getStore().set(PRIVACY_CLEANUP_KEY, JSON.stringify(cleanup));
}

export async function clearAppResetPrivacyCleanup(id: string): Promise<void> {
  const control = getStore();
  const value = control.getString(PRIVACY_CLEANUP_KEY);
  if (value && (JSON.parse(value) as IAppResetPrivacyCleanup).id === id) {
    control.remove(PRIVACY_CLEANUP_KEY);
  }
}

export async function armAppRecoveryTestFaults(
  faults: IAppRecoveryTestFault[],
): Promise<void> {
  const control = getStore();
  for (const fault of faults) control.set(fault, true);
}

export async function consumeAppRecoveryTestFault(
  fault: IAppRecoveryTestFault,
): Promise<boolean> {
  const control = getStore();
  if (control.getBoolean(fault) !== true) return false;
  control.remove(fault);
  return true;
}

export function listenForAppReset(_onIsolate: () => void) {}

export function broadcastAppReset(_stage: 'isolating' | 'completed') {}

export function runWithAppResetLock<T>(task: () => Promise<T>): Promise<T> {
  return task();
}
