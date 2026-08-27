import { createMMKV } from 'react-native-mmkv';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { ILocalSecretEnvelopeMmkvProfileKeyStorage } from './mmkvProfileKeyLayerAdapter';

// Keep the LSE profile key outside the general app-settings MMKV instance so
// generic settings cleanup cannot orphan Realm ciphertext. Explicit App Reset
// removes this key in a dedicated crypto-erasure step immediately before Realm.
const mmkvProfileKeyStorageInstance = createMMKV({
  id: 'onekey-local-secret-envelope',
});

const mmkvProfileKeyStorage: ILocalSecretEnvelopeMmkvProfileKeyStorage = {
  async getItem(keyRef) {
    return mmkvProfileKeyStorageInstance.getString(keyRef) ?? null;
  },
  async getOrCreateItem(keyRef, createKeyHex) {
    const existingKeyHex = mmkvProfileKeyStorageInstance.getString(keyRef);
    if (existingKeyHex) {
      return existingKeyHex;
    }

    // LSE writes are owned by the native background runtime. Keeping the MMKV
    // read-create-write sequence synchronous prevents interleaving in that JS
    // runtime while the native MMKV instance remains shared with main.
    mmkvProfileKeyStorageInstance.set(keyRef, createKeyHex());
    const persistedKeyHex = mmkvProfileKeyStorageInstance.getString(keyRef);
    if (!persistedKeyHex) {
      throw new OneKeyLocalError(
        'Local secret envelope MMKV profile key persist failed',
      );
    }
    return persistedKeyHex;
  },
  async removeItem(keyRef) {
    mmkvProfileKeyStorageInstance.remove(keyRef);
  },
  async setItem(keyRef, keyHex) {
    mmkvProfileKeyStorageInstance.set(keyRef, keyHex);
    if (mmkvProfileKeyStorageInstance.getString(keyRef) !== keyHex) {
      throw new OneKeyLocalError(
        'Local secret envelope MMKV profile key persist failed',
      );
    }
  },
  async supportStorage() {
    return true;
  },
};

export default mmkvProfileKeyStorage;
