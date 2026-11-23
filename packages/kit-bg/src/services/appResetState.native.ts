import { createMMKV } from 'react-native-mmkv';

import type { IAppResetMarker } from './appResetState';

export const APP_RESET_CONTROL_NAME = 'onekey-app-reset-control';
const KEY = 'pending';

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

export function listenForAppReset(_onIsolate: () => void) {}

export function broadcastAppReset(_stage: 'isolating' | 'completed') {}

export function runWithAppResetLock<T>(task: () => Promise<T>): Promise<T> {
  return task();
}
