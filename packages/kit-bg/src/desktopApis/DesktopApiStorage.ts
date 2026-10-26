import * as store from '@onekeyhq/desktop/app/libs/store';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EDesktopStoreKeys } from '@onekeyhq/shared/types/desktop';
import type { IDesktopStoreMap } from '@onekeyhq/shared/types/desktop';

import type { IDesktopApi } from './instance/IDesktopApi';

class DesktopApiStorage {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  private assertAllowedKey(key: unknown) {
    if (key !== EDesktopStoreKeys.AppInstanceMetaBackup) {
      throw new OneKeyLocalError('Desktop store key is not allowed');
    }
  }

  async storeSetItemAsync<T extends EDesktopStoreKeys.AppInstanceMetaBackup>(
    key: T,
    value: IDesktopStoreMap[T],
  ): Promise<void> {
    this.assertAllowedKey(key);
    store.getStoreForKey(key).set(key, value);
  }

  async storeGetItemAsync<T extends EDesktopStoreKeys.AppInstanceMetaBackup>(
    key: T,
  ): Promise<IDesktopStoreMap[T]> {
    this.assertAllowedKey(key);
    return store.getStoreForKey(key).get(key);
  }

  async storeDelItemAsync<T extends EDesktopStoreKeys.AppInstanceMetaBackup>(
    key: T,
  ): Promise<void> {
    this.assertAllowedKey(key);
    store.getStoreForKey(key).delete(key);
  }

  async resetAppConfiguration(): Promise<void> {
    store.clear();
  }

  async secureSetItemAsync(key: string, value: string): Promise<void> {
    store.setSecureItem(key, value);
  }

  async secureGetItemAsync(key: string): Promise<string | null> {
    const value = store.getSecureItem(key);
    return value || null;
  }

  async secureDelItemAsync(key: string): Promise<void> {
    store.deleteSecureItem(key);
  }

  async isSecureStorageAvailable(): Promise<boolean> {
    return store.isSecureStorageAvailable();
  }
}

export default DesktopApiStorage;
