import * as store from '@onekeyhq/desktop/app/libs/store';
import type {
  EDesktopStoreKeys,
  IDesktopStoreMap,
} from '@onekeyhq/shared/types/desktop';

class DesktopApiStorage {
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
}

export default DesktopApiStorage;
