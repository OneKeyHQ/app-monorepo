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
  reloadManifest(): Promise<void>;
}

let legacyModule: ILegacyAsyncStorageNativeModule | undefined;
let legacyMigrationAdapter: ILegacyAsyncStorageNativeModule | undefined;
let legacyOperationChain: Promise<void> = Promise.resolve();

function logManifestRefreshFailure(error: unknown) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NativeLogger, LogLevel } =
      require('../modules3rdParty/react-native-file-logger') as typeof import('../modules3rdParty/react-native-file-logger');
    const errorType =
      error instanceof Error && error.name ? error.name : 'UnknownError';
    NativeLogger.write(
      LogLevel.Info,
      `[NativeStorageMigration] iOS manifest refresh result=failed errorType=${errorType}; using current manifest`,
    );
  } catch {
    // Legacy access must not depend on diagnostics being available.
  }
}

function enqueueLegacyOperation<T>(operation: () => Promise<T>): Promise<T> {
  const execution = legacyOperationChain.then(operation, operation);
  legacyOperationChain = execution.then(
    () => undefined,
    () => undefined,
  );
  return execution;
}

function runWithFreshIOSManifest<T>(
  module: ILegacyAsyncStorageNativeModule,
  operation: () => Promise<T>,
) {
  return enqueueLegacyOperation(async () => {
    if (platformEnv.isNativeIOS) {
      try {
        await module.reloadManifest();
      } catch (error) {
        // Match the public AsyncStorage wrapper: data protection can make a
        // refresh temporarily unavailable while the current manifest is valid.
        logManifestRefreshFailure(error);
      }
    }
    return operation();
  });
}

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
    getAllKeys: () =>
      runWithFreshIOSManifest(module, () => module.getAllKeys()),
    multiGet: (keys) =>
      runWithFreshIOSManifest(module, () =>
        multiGetWithOversizedRowFallback(module, keys),
      ),
    multiRemove: (keys) =>
      runWithFreshIOSManifest(module, () => module.multiRemove(keys)),
    multiSet: (entries) =>
      runWithFreshIOSManifest(module, () => module.multiSet(entries)),
    reloadManifest: () => enqueueLegacyOperation(() => module.reloadManifest()),
  } as ILegacyAsyncStorageNativeModule;
  return legacyMigrationAdapter;
}
