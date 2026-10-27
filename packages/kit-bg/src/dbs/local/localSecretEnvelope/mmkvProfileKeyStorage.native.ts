import { createMMKV } from 'react-native-mmkv';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

import type { ILocalSecretEnvelopeMmkvProfileKeyStorage } from './mmkvProfileKeyLayerAdapter';

// Keep the LSE profile key outside the general app-settings MMKV instance so
// generic settings cleanup cannot orphan Realm ciphertext. Explicit App Reset
// removes this key in a dedicated crypto-erasure step immediately before Realm.
let mmkvProfileKeyStorageInstance: ReturnType<typeof createMMKV> | undefined;

function getMMKVProfileKeyStorageInstance() {
  mmkvProfileKeyStorageInstance ??= createMMKV({
    id: 'onekey-local-secret-envelope',
  });
  return mmkvProfileKeyStorageInstance;
}

const mmkvProfileKeyStorage: ILocalSecretEnvelopeMmkvProfileKeyStorage = {
  async getItem(keyRef) {
    const environment = await travelModeManager.getRuntimeEnvironment();
    return environment.persistence.run({
      operation: async () =>
        getMMKVProfileKeyStorageInstance().getString(keyRef) ?? null,
      onBlocked: () => null,
    });
  },
  async getOrCreateItem(keyRef, createKeyHex) {
    const environment = await travelModeManager.getRuntimeEnvironment();
    return environment.persistence.run({
      operation: async () => {
        const storage = getMMKVProfileKeyStorageInstance();
        const existingKeyHex = storage.getString(keyRef);
        if (existingKeyHex) {
          return existingKeyHex;
        }
        // LSE writes are owned by the native background runtime. Keeping the
        // read-create-write sequence synchronous prevents interleaving in this
        // JS runtime while the native MMKV instance remains shared with main.
        storage.set(keyRef, createKeyHex());
        const persistedKeyHex = storage.getString(keyRef);
        if (!persistedKeyHex) {
          throw new OneKeyLocalError(
            'Local secret envelope MMKV profile key persist failed',
          );
        }
        return persistedKeyHex;
      },
      onBlocked: () => {
        throw new OneKeyLocalError(
          'Local secret envelope MMKV profile key is unavailable',
        );
      },
    });
  },
  async removeItem(keyRef) {
    const environment = await travelModeManager.getRuntimeEnvironment();
    return environment.persistence.run({
      operation: async () => {
        getMMKVProfileKeyStorageInstance().remove(keyRef);
      },
      onBlocked: () => undefined,
    });
  },
  async setItem(keyRef, keyHex) {
    const environment = await travelModeManager.getRuntimeEnvironment();
    return environment.persistence.run({
      operation: async () => {
        const storage = getMMKVProfileKeyStorageInstance();
        storage.set(keyRef, keyHex);
        if (storage.getString(keyRef) !== keyHex) {
          throw new OneKeyLocalError(
            'Local secret envelope MMKV profile key persist failed',
          );
        }
      },
      onBlocked: () => undefined,
    });
  },
  async supportStorage(): Promise<boolean> {
    const environment = await travelModeManager.getRuntimeEnvironment();
    return environment.persistence.run({
      operation: async () => true,
      onBlocked: () => false,
    });
  },
};

export default mmkvProfileKeyStorage;
