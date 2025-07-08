import * as store from '@onekeyhq/desktop/app/libs/store';
import type {
  EDesktopStoreKeys,
  IDesktopStoreMap,
} from '@onekeyhq/shared/types/desktop';

import type { IDesktopApi } from './instance/IDesktopApi';

class DesktopApiStorage {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  async storeSetItemAsync<T extends EDesktopStoreKeys>(
    key: T,
    value: IDesktopStoreMap[T],
  ): Promise<void> {
    store.instance.set(key, value);
  }

  async storeGetItemAsync<T extends EDesktopStoreKeys>(
    key: T,
  ): Promise<IDesktopStoreMap[T]> {
    return store.instance.get(key);
  }

  async storeDelItemAsync<T extends EDesktopStoreKeys>(key: T): Promise<void> {
    store.instance.delete(key);
  }

  async storeClear(): Promise<void> {
    store.instance.clear();
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
}

export default DesktopApiStorage;
