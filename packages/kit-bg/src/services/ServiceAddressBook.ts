import { Semaphore } from 'async-mutex';

import type {
  IAddressItem,
  IAddressNetworkItem,
} from '@onekeyhq/kit/src/views/AddressBook/type';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { type IDBCloudSyncItem } from '../dbs/local/types';
import { addressBookPersistAtom } from '../states/jotai/atoms/addressBooks';
import { devSettingsPersistAtom } from '../states/jotai/atoms/devSettings';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceAddressBook extends ServiceBase {
  // Kept for compatibility with ServicePassword cache reset hooks.
  verifyHashTimestamp?: number;

  mutex = new Semaphore(1);

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private async setItems({
    items,
    skipEventEmit,
  }: {
    items: IAddressItem[];
    skipEventEmit?: boolean;
  }): Promise<void> {
    const { simpleDb } = this.backgroundApi;
    await simpleDb.addressBook.updateItemsAndHash({ items, hash: '' });
    this.verifyHashTimestamp = undefined;

    if (!skipEventEmit) {
      await addressBookPersistAtom.set((prev) => ({
        ...prev,
        updateTimestamp: Date.now(),
      }));
    }

    void this.backgroundApi.serviceCloudBackup.requestAutoBackup();
  }

  private async getItems(): Promise<IAddressItem[]> {
    const { simpleDb } = this.backgroundApi;
    const { items } = await simpleDb.addressBook.getItemsAndHash();
    return items;
  }

  public verifyHash(_params?: {
    returnValue?: boolean;
    password?: string;
  }): Promise<boolean> {
    return Promise.resolve(true);
  }

  @backgroundMethod()
  async getSafeRawItems({
    throwErrorIfNotSafe,
  }: {
    throwErrorIfNotSafe?: boolean;
    password?: string;
  } = {}): Promise<{ isSafe: boolean; items: IAddressItem[] }> {
    void throwErrorIfNotSafe;
    const items = await this.getItems();
    return { isSafe: true, items };
  }

  @backgroundMethod()
  @toastIfError()
  async getSafeItems(
    params: {
      networkId?: string;
      exact?: boolean;
      password?: string;
    } = {},
  ): Promise<{ isSafe: boolean; items: IAddressNetworkItem[] }> {
    const { networkId, exact } = params;
    let { items: rawItems } = await this.getSafeRawItems({});
    if (networkId) {
      if (exact) {
        rawItems = rawItems.filter((item) => item.networkId === networkId);
      } else {
        const [impl] = networkId.split('--');
        rawItems = rawItems.filter((item) =>
          item.networkId.startsWith(`${impl}--`),
        );
      }
    }
    const promises = rawItems.map(async (item) => {
      const network = await this.backgroundApi.serviceNetwork.getNetworkSafe({
        networkId: item.networkId,
      });
      if (!network) {
        return undefined;
      }
      return {
        ...item,
        network,
      };
    });
    const items = (await Promise.all(promises)).filter(Boolean);
    return { isSafe: true, items };
  }

  @backgroundMethod()
  async __dangerTamperVerifyHashForTest() {
    const { enabled } = await devSettingsPersistAtom.get();
    if (!(platformEnv.isDev || enabled)) {
      return;
    }
    const items = await this.getItems();
    await this.backgroundApi.simpleDb.addressBook.updateItemsAndHash({
      items,
      hash: String(Date.now()),
    });
  }

  @backgroundMethod()
  async resetItems() {
    await this.mutex.runExclusive(async () => {
      await this.setItems({
        items: [],
      });
    });
  }

  private async validateItem(item: IAddressItem) {
    const { serviceValidator } = this.backgroundApi;
    if (item.name.length > 24) {
      throw new OneKeyLocalError('Name is too long');
    }
    let result = await this.findItem({ address: item.address });
    if (result && (!item.id || result.id !== item.id)) {
      throw new OneKeyLocalError('Address already exist');
    }
    result = await this.findItem({ name: item.name });
    if (result && (!item.id || result.id !== item.id)) {
      throw new OneKeyLocalError('Name already exist');
    }
    const validStatus = await serviceValidator.validateAddress({
      networkId: item.networkId,
      address: item.address,
    });
    if (validStatus !== 'valid') {
      throw new OneKeyLocalError('Invalid address');
    }
  }

  async buildAddressBookSyncItems({
    items,
    isDeleted,
  }: {
    items: IAddressItem[];
    isDeleted: boolean | undefined;
  }): Promise<IDBCloudSyncItem[]> {
    const syncManagers = this.backgroundApi.servicePrimeCloudSync.syncManagers;
    const now = await this.backgroundApi.servicePrimeCloudSync.timeNow();
    const syncCredential =
      await this.backgroundApi.servicePrimeCloudSync.getSyncCredentialSafe();

    const syncItems = (
      await Promise.all(
        items.map(async (item) => {
          return syncManagers.addressBook.buildSyncItemByDBQuery({
            syncCredential,
            dbRecord: item,
            isDeleted,
            dataTime: now,
          });
        }),
      )
    ).filter(Boolean);
    return syncItems;
  }

  async withAddressBookCloudSync({
    fn,
    items,
    isDeleted,
    skipSaveLocalSyncItem,
  }: {
    fn: () => Promise<void>;
    items: IAddressItem[];
    isDeleted: boolean | undefined;
    skipSaveLocalSyncItem: boolean | undefined;
    skipEventEmit: boolean | undefined;
  }) {
    let syncItems: IDBCloudSyncItem[] = [];
    if (!skipSaveLocalSyncItem) {
      syncItems = await this.buildAddressBookSyncItems({
        items,
        isDeleted,
      });
    }
    await this.backgroundApi.localDb.addAndUpdateSyncItems({
      items: syncItems,
      fn,
    });
  }

  async addItemFn(
    newObj: IAddressItem,
    options: {
      skipSaveLocalSyncItem: boolean | undefined;
      skipEventEmit: boolean | undefined;
    },
  ) {
    await this.mutex.runExclusive(async () => {
      const { items } = await this.getSafeRawItems({
        throwErrorIfNotSafe: true,
      });
      newObj.id = newObj.id || generateUUID();
      newObj.createdAt = newObj.createdAt || Date.now();
      newObj.updatedAt = newObj.updatedAt || Date.now();
      items.push(newObj);

      await this.withAddressBookCloudSync({
        fn: async () => {
          await this.setItems({
            items,
            skipEventEmit: options.skipEventEmit,
          });
          defaultLogger.setting.page.addAddressBook({
            network: newObj.networkId,
          });
        },
        items: [newObj],
        isDeleted: false,
        skipSaveLocalSyncItem: options.skipSaveLocalSyncItem,
        skipEventEmit: options.skipEventEmit,
      });
    });
  }

  @backgroundMethod()
  public async addItem(
    newObj: IAddressItem,
    options: {
      skipSaveLocalSyncItem?: boolean;
      skipEventEmit?: boolean;
    } = {},
  ) {
    await this.validateItem(newObj);

    await this.addItemFn(newObj, {
      ...options,
      skipSaveLocalSyncItem: options.skipSaveLocalSyncItem,
      skipEventEmit: options.skipEventEmit,
    });
  }

  async updateItemFn(
    obj: IAddressItem,
    options: {
      skipSaveLocalSyncItem: boolean | undefined;
      skipEventEmit: boolean | undefined;
    },
  ) {
    await this.mutex.runExclusive(async () => {
      const { items } = await this.getSafeRawItems({
        throwErrorIfNotSafe: true,
      });
      const dataIndex = items.findIndex((i) => i.id === obj.id);
      if (dataIndex >= 0) {
        const data = items[dataIndex];

        const newObj = { ...data, ...obj };
        newObj.updatedAt = newObj.updatedAt || Date.now();
        items[dataIndex] = newObj;

        await this.withAddressBookCloudSync({
          fn: async () => {
            await this.setItems({
              items,
              skipEventEmit: options.skipEventEmit,
            });
            // Check if name is changing and record history if it is
            if (obj.id && obj.name && data.name !== obj.name) {
              await this.backgroundApi.simpleDb.changeHistory.addChangeHistory({
                items: [
                  {
                    entityType: EChangeHistoryEntityType.AddressBook,
                    entityId: obj.id,
                    contentType: EChangeHistoryContentType.Name,
                    oldValue: data.name,
                    value: obj.name,
                  },
                ],
              });
            }
          },
          items: [newObj],
          isDeleted: false,
          skipSaveLocalSyncItem: options.skipSaveLocalSyncItem,
          skipEventEmit: options.skipEventEmit,
        });
      } else {
        throw new OneKeyLocalError(
          `Failed to find item with id = ${obj.id || ''}`,
        );
      }
    });
  }

  @backgroundMethod()
  public async updateItem(
    obj: IAddressItem,
    options: {
      skipSaveLocalSyncItem?: boolean;
      skipEventEmit?: boolean;
    } = {},
  ) {
    if (!obj.id) {
      throw new OneKeyLocalError('Missing id');
    }
    await this.validateItem(obj);

    await this.updateItemFn(obj, {
      ...options,
      skipSaveLocalSyncItem: options.skipSaveLocalSyncItem,
      skipEventEmit: options.skipEventEmit,
    });
  }

  async removeItemFn(
    removedItem: IAddressItem,
    options: {
      skipSaveLocalSyncItem: boolean | undefined;
      skipEventEmit: boolean | undefined;
    },
  ) {
    await this.mutex.runExclusive(async () => {
      const { items } = await this.getSafeRawItems({
        throwErrorIfNotSafe: true,
      });
      await this.withAddressBookCloudSync({
        fn: async () => {
          const data = items.filter((i) => i.id !== removedItem.id);
          await this.setItems({
            items: data,
            skipEventEmit: options.skipEventEmit,
          });
          const remove = items.filter((i) => i.id === removedItem.id);
          if (remove.length > 0) {
            remove.forEach((o) => {
              defaultLogger.setting.page.removeAddressBook({
                network: o.networkId,
              });
            });
          }
        },
        items: [removedItem],
        isDeleted: true,
        skipSaveLocalSyncItem: options.skipSaveLocalSyncItem,
        skipEventEmit: options.skipEventEmit,
      });
    });
  }

  @backgroundMethod()
  public async removeItem(
    id: string,
    options: {
      skipSaveLocalSyncItem?: boolean;
      skipEventEmit?: boolean;
    } = {},
  ) {
    const { items } = await this.getSafeRawItems({});
    const removedItem = items.find((i) => i.id === id);
    if (!removedItem) {
      throw new OneKeyLocalError(`Failed to find item with id = ${id}`);
    }

    return this.removeItemFn(removedItem, {
      ...options,
      skipSaveLocalSyncItem: options.skipSaveLocalSyncItem,
      skipEventEmit: options.skipEventEmit,
    });
  }

  _findItemByConditions({
    items,
    networkId,
    networkImpl,
    address,
    name,
  }: {
    items: IAddressItem[];
    networkId?: string;
    networkImpl?: string;
    address?: string;
    name?: string;
  }): IAddressItem | undefined {
    return items.find((item) => {
      // 创建条件检查函数数组
      const conditions = [];

      if (networkId) {
        conditions.push(() => item.networkId === networkId);
      }

      if (networkImpl) {
        conditions.push(() => {
          const impl = networkUtils.getNetworkImpl({
            networkId: item.networkId,
          });
          return impl === networkImpl;
        });
      }

      if (address) {
        conditions.push(
          () => item.address.toLowerCase() === address.toLowerCase(),
        );
      }

      if (name) {
        conditions.push(() => item.name.toLowerCase() === name.toLowerCase());
      }

      // 如果没有任何条件被添加，返回false
      if (conditions.length === 0) {
        return false;
      }

      // 所有条件都必须为true
      return conditions.every((condition) => condition());
    });
  }

  @backgroundMethod()
  public async findItem(
    params: {
      password?: string;
      networkImpl?: string;
      networkId?: string;
      address?: string;
      name?: string;
    } = {},
  ): Promise<IAddressItem | undefined> {
    const { address, name, networkId, networkImpl } = params;
    const { items } = await this.getSafeRawItems({});
    return this._findItemByConditions({
      items,
      networkId,
      networkImpl,
      address,
      name,
    });
  }

  @backgroundMethod()
  public async findItemById({
    id,
  }: {
    id: string;
    password?: string;
  }): Promise<IAddressItem | undefined> {
    const { items } = await this.getSafeRawItems({});
    const item = items.find((i) => i.id === id);
    return item;
  }

  @backgroundMethod()
  public async stringifyUnSafeItems() {
    const { serviceNetwork } = this.backgroundApi;
    const rawItems = await this.getItems();
    const result: string[] = [];
    for (let i = 0; i < rawItems.length; i += 1) {
      const item = rawItems[i];
      const network = await serviceNetwork.getNetworkSafe({
        networkId: item.networkId,
      });
      if (network) {
        const title = network.id.startsWith('evm--') ? 'EVM' : network.name;
        const text = `${title} ${item.name} ${item.address}`;
        result.push(text);
      }
    }
    return result.join('\n');
  }

  public updateHash(_newPassword: string) {
    return Promise.resolve();
  }

  public finishUpdateHash() {
    return Promise.resolve();
  }

  public rollback(_oldPassword: string) {
    return Promise.resolve();
  }

  @backgroundMethod()
  public async hideDialogInfo() {
    await addressBookPersistAtom.set((prev) => ({
      ...prev,
      hideDialogInfo: true,
    }));
  }

  // for Migration
  @backgroundMethod()
  async bulkSetItemsWithUniq(items: IAddressItem[], _password?: string) {
    await this.mutex.runExclusive(async () => {
      const currentItems = await this.getItems(); // v4 items is not hashed, so we can only get raw items without safe check
      const currentAddressSet = new Set(
        currentItems.map((i) => i.address.toLowerCase()),
      );
      const currentNameSet = new Set(
        currentItems.map((i) => i.name.toLowerCase()),
      );
      const itemsUniq: IAddressItem[] = [];
      for (let i = 0; i < items.length; i += 1) {
        const o = items[i];
        const lowerCaseAddress = o.address.toLowerCase();
        const lowerCaseName = o.name.toLowerCase();
        if (!currentAddressSet.has(lowerCaseAddress)) {
          if (currentNameSet.has(lowerCaseName)) {
            await timerUtils.wait(5);
            o.name = `${o.name} (${Date.now()})`;
          }
          itemsUniq.push(o);
          currentAddressSet.add(lowerCaseAddress);
          currentNameSet.add(o.name.toLowerCase());
        }
      }
      const itemsToAdd = currentItems.concat(itemsUniq);
      await this.setItems({
        items: itemsToAdd,
      });
    });
  }

  @backgroundMethod()
  async dangerouslyFindItemWithoutSafeCheck(params: {
    networkImpl?: string;
    networkId?: string;
    address?: string;
    name?: string;
  }): Promise<IAddressItem | undefined> {
    const { networkId, networkImpl, address, name } = params;
    const items = await this.getItems();
    return this._findItemByConditions({
      items,
      networkId,
      networkImpl,
      address,
      name,
    });
  }

  @backgroundMethod()
  async dangerouslyGetItemsWithoutSafeCheck(params: {
    networkId?: string;
  }): Promise<IAddressItem[]> {
    const { networkId } = params;
    const items = await this.getItems();
    if (!networkId) {
      return items;
    }
    return items.filter((item) => item.networkId === networkId);
  }
}

export default ServiceAddressBook;
