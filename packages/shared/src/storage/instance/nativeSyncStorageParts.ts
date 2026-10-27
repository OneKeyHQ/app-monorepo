/**
 * Non-native stub for the native sync-storage assembly.
 *
 * Web, desktop and extension builds resolve this file instead of
 * `nativeSyncStorageParts.native.ts`, so the native mirror / broadcast /
 * MMKV-sync module chains (and their `react-native` imports) never enter
 * non-native bundles or startup graphs. Every entry point below is guarded
 * by `platformEnv.isNative*` checks at the call sites and must not run here.
 */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { ISyncStorage } from './createMMKVSyncStorage';
import type { INativeSyncStorageLocalMutation } from '../nativeStorageTypes';

function throwNativeOnly(apiName: string): never {
  throw new OneKeyLocalError(`${apiName} is only available on native runtimes`);
}

export function createNativeSettingsSyncStorage(): ISyncStorage {
  return throwNativeOnly('createNativeSettingsSyncStorage');
}

export function createNativeColdStartCacheStorage(): ISyncStorage {
  return throwNativeOnly('createNativeColdStartCacheStorage');
}

export function createNativeDevSettingStorageMirror(): never {
  return throwNativeOnly('createNativeDevSettingStorageMirror');
}

export function broadcastNativeDevSettingMutation(
  _mutation: INativeSyncStorageLocalMutation,
): void {
  throwNativeOnly('broadcastNativeDevSettingMutation');
}
