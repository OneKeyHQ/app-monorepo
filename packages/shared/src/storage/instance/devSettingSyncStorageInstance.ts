import platformEnv from '../../platformEnv';
import { travelModeManager } from '../../travelMode';

import {
  broadcastNativeDevSettingMutation,
  createNativeDevSettingStorageMirror,
} from './nativeSyncStorageParts';

import type { INativeSyncStorageLocalMutation } from '../nativeStorageTypes';
import type { EDevSettingSyncStorageKeys } from '../syncStorageKeys';

function broadcastMutation(mutation: INativeSyncStorageLocalMutation) {
  if (platformEnv.isNativeBackgroundThread) {
    broadcastNativeDevSettingMutation(mutation);
  }
}

type IDevSettingStorageInstance = {
  set(key: string, value: boolean | string | number): void | Promise<void>;
  getBoolean(key: string): boolean | undefined;
  remove(key: string): void | Promise<void>;
  clearAll(): void | Promise<void>;
};

function getDevSettingStorageInstance(): IDevSettingStorageInstance {
  if (platformEnv.isNative && !platformEnv.isNativeBackgroundThread) {
    return createNativeDevSettingStorageMirror();
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./mmkvDevSettingStorageInstance')
    .default as IDevSettingStorageInstance;
}

let devSettingStorageInstance: IDevSettingStorageInstance | undefined;

function runWithDevSettingStorage<T>({
  operation,
  onBlocked,
}: {
  operation: (storage: IDevSettingStorageInstance) => T;
  onBlocked: () => T;
}): T {
  return travelModeManager.getRuntimeEnvironmentSync().persistence.runSync({
    operation: () => {
      devSettingStorageInstance ??= getDevSettingStorageInstance();
      return operation(devSettingStorageInstance);
    },
    onBlocked,
  });
}

const devSettingSyncStorageWeb = {
  set(key: EDevSettingSyncStorageKeys, value: boolean | string | number) {
    return runWithDevSettingStorage({
      operation: (storage) => {
        const acknowledgement = storage.set(key, value);
        broadcastMutation({ operation: 'set', key, value });
        return acknowledgement;
      },
      onBlocked: () => undefined,
    });
  },
  getBoolean(key: EDevSettingSyncStorageKeys) {
    return runWithDevSettingStorage({
      operation: (storage) => storage.getBoolean(key),
      onBlocked: () => undefined,
    });
  },
  delete(key: EDevSettingSyncStorageKeys) {
    return runWithDevSettingStorage({
      operation: (storage) => {
        const acknowledgement = storage.remove(key);
        broadcastMutation({ operation: 'remove', key });
        return acknowledgement;
      },
      onBlocked: () => undefined,
    });
  },
  clearAll() {
    return runWithDevSettingStorage({
      operation: (storage) => {
        const acknowledgement = storage.clearAll();
        broadcastMutation({ operation: 'clear' });
        return acknowledgement;
      },
      onBlocked: () => undefined,
    });
  },
};

export type IDevSettingSyncStorage = typeof devSettingSyncStorageWeb;

const devSettingSyncStorageExtBg: IDevSettingSyncStorage = {
  set(
    _key: EDevSettingSyncStorageKeys,
    _value: boolean | string | number,
  ): void {
    // do nothing
  },
  getBoolean(_key: EDevSettingSyncStorageKeys): boolean | undefined {
    // do nothing
    return undefined;
  },
  delete(_key: EDevSettingSyncStorageKeys): void {
    // do nothing
  },
  clearAll(): void {
    // do nothing
  },
};

// eslint-disable-next-line import/no-named-as-default-member
export const devSettingSyncStorage =
  platformEnv.isExtensionBackgroundServiceWorker
    ? devSettingSyncStorageExtBg
    : devSettingSyncStorageWeb;
