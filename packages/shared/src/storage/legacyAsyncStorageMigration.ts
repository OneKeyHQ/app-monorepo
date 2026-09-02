import { TurboModuleRegistry } from 'react-native';

import { OneKeyLocalError } from '../errors';
import platformEnv from '../platformEnv';

import { readLegacyAsyncStorageValueChunked } from './nativeStorageMigrationModule';

import type { TurboModule } from 'react-native';

export interface ILegacyAsyncStorageNativeModule extends TurboModule {
  multiGet(keys: string[]): Promise<Array<[string, string | null]>>;
  multiSet(entries: Array<[string, string]>): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
  getAllKeys(): Promise<string[]>;
}

let legacyModule: ILegacyAsyncStorageNativeModule | undefined;
let legacyMigrationAdapter: ILegacyAsyncStorageNativeModule | undefined;

function isAndroidOversizedRowError(error: unknown) {
  if (!platformEnv.isNativeAndroid) {
    return false;
  }
  const message =
    error instanceof Error ? error.message : String(error ?? 'unknown');
  return /CursorWindow|Row too big|SQLiteBlobTooBigException|Couldn't read row/i.test(
    message,
  );
}

async function multiGetWithOversizedRowFallback(
  module: ILegacyAsyncStorageNativeModule,
  keys: string[],
) {
  try {
    return await module.multiGet(keys);
  } catch (error) {
    if (!isAndroidOversizedRowError(error)) {
      throw error;
    }
    const entries: Array<[string, string | null]> = [];
    for (const key of keys) {
      entries.push([key, await readLegacyAsyncStorageValueChunked(key)]);
    }
    return entries;
  }
}

/**
 * The only allowed access to the legacy native AsyncStorage module.
 *
 * It deliberately bypasses the public package so Metro can redirect every
 * application and third-party package import to the bg proxy adapter.
 */
export function getLegacyAsyncStorageForMigration() {
  if (!platformEnv.isNativeBackgroundThread) {
    throw new OneKeyLocalError(
      'Legacy AsyncStorage migration is restricted to the native background runtime',
    );
  }
  legacyModule ??=
    TurboModuleRegistry.getEnforcing<ILegacyAsyncStorageNativeModule>(
      'RNCAsyncStorage',
    );
  const module = legacyModule;
  legacyMigrationAdapter ??= {
    getAllKeys: () => module.getAllKeys(),
    multiGet: (keys) => multiGetWithOversizedRowFallback(module, keys),
    multiRemove: (keys) => module.multiRemove(keys),
    multiSet: (entries) => module.multiSet(entries),
  } as ILegacyAsyncStorageNativeModule;
  return legacyMigrationAdapter;
}
