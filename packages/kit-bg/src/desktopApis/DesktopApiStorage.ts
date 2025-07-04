import { ipcRenderer } from 'electron';

import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import type {
  EDesktopStoreKeys,
  IDesktopStoreMap,
} from '@onekeyhq/shared/types/desktop';

class DesktopApiStorage {
  async storeSetItemAsync<T extends EDesktopStoreKeys>(
    key: T,
    value: IDesktopStoreMap[T],
  ): Promise<void> {
    return ipcRenderer.sendSync(ipcMessageKeys.STORE_SET_ITEM_ASYNC, {
      key,
      value,
    });
  }

  async storeGetItemAsync<T extends EDesktopStoreKeys>(
    key: T,
  ): Promise<IDesktopStoreMap[T]> {
    return ipcRenderer.sendSync(ipcMessageKeys.STORE_GET_ITEM_ASYNC, { key });
  }

  async storeDelItemAsync<T extends EDesktopStoreKeys>(key: T): Promise<void> {
    return ipcRenderer.sendSync(ipcMessageKeys.STORE_DEL_ITEM_ASYNC, { key });
  }

  async storeClear(): Promise<void> {
    return ipcRenderer.sendSync(ipcMessageKeys.STORE_CLEAR);
  }
}

export default DesktopApiStorage;
