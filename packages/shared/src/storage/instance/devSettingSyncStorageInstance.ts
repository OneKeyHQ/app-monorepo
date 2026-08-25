import platformEnv from '../../platformEnv';
import { broadcastNativeSyncStorageMutation } from '../nativeSyncStorageBroadcast';

import type { INativeSyncStorageLocalMutation } from '../nativeStorageTypes';
import type { EDevSettingSyncStorageKeys } from '../syncStorageKeys';

function broadcastMutation(mutation: INativeSyncStorageLocalMutation) {
  if (platformEnv.isNativeBackgroundThread) {
    if (mutation.operation === 'set') {
      broadcastNativeSyncStorageMutation({
        store: 'devSettings',
        operation: 'set',
        key: mutation.key,
        value: mutation.value,
      });
    } else if (mutation.operation === 'remove') {
      broadcastNativeSyncStorageMutation({
        store: 'devSettings',
        operation: 'remove',
        key: mutation.key,
      });
    } else {
      broadcastNativeSyncStorageMutation({
        store: 'devSettings',
        operation: 'clear',
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { scheduleNativeStorageMMKVSync } =
      require('../nativeStorageMigrationModule') as typeof import('../nativeStorageMigrationModule');
    scheduleNativeStorageMMKVSync('onekey-app-dev-setting');
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createNativeSyncStorageMirror } =
      require('./nativeSyncStorageMirror') as typeof import('./nativeSyncStorageMirror');
    return createNativeSyncStorageMirror('devSettings');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./mmkvDevSettingStorageInstance')
    .default as IDevSettingStorageInstance;
}

const devSettingStorageInstance = getDevSettingStorageInstance();

const devSettingSyncStorageWeb = {
  set(key: EDevSettingSyncStorageKeys, value: boolean | string | number) {
    const acknowledgement = devSettingStorageInstance.set(key, value);
    broadcastMutation({ operation: 'set', key, value });
    return acknowledgement;
  },
  getBoolean(key: EDevSettingSyncStorageKeys) {
    return devSettingStorageInstance.getBoolean(key);
  },
  delete(key: EDevSettingSyncStorageKeys) {
    const acknowledgement = devSettingStorageInstance.remove(key);
    broadcastMutation({ operation: 'remove', key });
    return acknowledgement;
  },
  clearAll() {
    const acknowledgement = devSettingStorageInstance.clearAll();
    broadcastMutation({ operation: 'clear' });
    return acknowledgement;
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
