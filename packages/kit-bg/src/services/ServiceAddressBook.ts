import { Semaphore } from 'async-mutex';

import { decodeSensitiveTextAsync } from '@onekeyhq/core/src/secret';
import { hash160 } from '@onekeyhq/core/src/secret/hash';
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
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { type IDBCloudSyncItem } from '../dbs/local/types';
import { addressBookPersistAtom } from '../states/jotai/atoms/addressBooks';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceAddressBook extends ServiceBase {
  mutex = new Semaphore(1);

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  // ---------------------------------------------------------------------------
  // Core data access (no password required)
  // ---------------------------------------------------------------------------

  private async setItems({
    items,
    skipEventEmit,
  }: {
    items: IAddressItem[];
    skipEventEmit?: boolean;
  }): Promise<void> {
    const { simpleDb } = this.backgroundApi;
    await simpleDb.addressBook.updateItems(items);

    if (!skipEventEmit) {
      await addressBookPersistAtom.set((prev) => ({
        ...prev,
        updateTimestamp: Date.now(),
      }));
    }

    void this.backgroundApi.serviceCloudBackup.requestAutoBackup();
  }

  private async getRawItems(): Promise<IAddressItem[]> {
    const { simpleDb } = this.backgroundApi;
    return simpleDb.addressBook.getItems();
  }

  // ---------------------------------------------------------------------------
  // Public read methods
  // ---------------------------------------------------------------------------

  @backgroundMethod()
  @toastIfError()
  async getNetworkItems(params?: {
    networkId?: string;
    exact?: boolean;
  }): Promise<{ items: IAddressNetworkItem[] }> {
    const { networkId, exact } = params ?? {};
    let rawItems = await this.getRawItems();
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
    return { items };
  }

  @backgroundMethod()
  public async findItem(params: {
    networkImpl?: string;
    networkId?: string;
    address?: string;
    name?: string;
  }): Promise<IAddressItem | undefined> {
    const { networkId, networkImpl, address, name } = params;
    const items = await this.getRawItems();
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
  }): Promise<IAddressItem | undefined> {
    const items = await this.getRawItems();
    return items.find((i) => i.id === id);
  }

  @backgroundMethod()
  async getItemsByNetwork(params: {
    networkId?: string;
  }): Promise<IAddressItem[]> {
    const { networkId } = params;
    const items = await this.getRawItems();
    if (!networkId) {
      return items;
    }
    if (networkUtils.isEvmNetwork({ networkId })) {
      return items.filter((item) =>
        networkUtils.isEvmNetwork({ networkId: item.networkId }),
      );
    }
    return items.filter((item) => item.networkId === networkId);
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Cloud sync helpers
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Write operations (no password required)
  // ---------------------------------------------------------------------------

  async addItemFn(
    newObj: IAddressItem,
    options: {
      skipSaveLocalSyncItem: boolean | undefined;
      skipEventEmit: boolean | undefined;
    },
  ) {
    await this.mutex.runExclusive(async () => {
      const items = await this.getRawItems();
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
      const items = await this.getRawItems();
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
      const items = await this.getRawItems();
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
    const items = await this.getRawItems();
    const removedItem = items.find((i) => i.id === id);
    if (!removedItem) {
      throw new OneKeyLocalError(`Failed to find item with id = ${id}`);
    }

    return this.removeItemFn(removedItem, {
      skipSaveLocalSyncItem: options.skipSaveLocalSyncItem,
      skipEventEmit: options.skipEventEmit,
    });
  }

  @backgroundMethod()
  async clearAllItems() {
    await this.mutex.runExclusive(async () => {
      await this.setItems({ items: [] });
    });
  }

  // ---------------------------------------------------------------------------
  // Bulk import (for migration & backup restore)
  // ---------------------------------------------------------------------------

  @backgroundMethod()
  async bulkSetItemsWithUniq(items: IAddressItem[]) {
    await this.mutex.runExclusive(async () => {
      const currentItems = await this.getRawItems();
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
      await this.setItems({ items: itemsToAdd });
    });
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

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

      if (conditions.length === 0) {
        return false;
      }

      return conditions.every((condition) => condition());
    });
  }

  @backgroundMethod()
  public async stringifyItems() {
    const { serviceNetwork } = this.backgroundApi;
    const rawItems = await this.getRawItems();
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

  @backgroundMethod()
  public async hideDialogInfo() {
    await addressBookPersistAtom.set((prev) => ({
      ...prev,
      hideDialogInfo: true,
    }));
  }

  // ---------------------------------------------------------------------------
  // Migration: remove hash verification (run once at app unlock)
  // ---------------------------------------------------------------------------

  @backgroundMethod()
  async migrateRemoveHash({ password }: { password: string }) {
    await this.mutex.runExclusive(async () => {
      const { simpleDb } = this.backgroundApi;
      const { items, hash } = await simpleDb.addressBook.getItemsAndHash();

      // Already migrated or fresh install
      if (!hash) {
        return;
      }

      // Verify hash one last time (best effort, never lose data)
      try {
        const isValid = await this._verifyHashLegacy({
          itemsToVerify: items,
          password,
        });
        if (!isValid) {
          console.warn(
            'Address book hash mismatch during migration, keeping items',
          );
        }
      } catch (e) {
        console.warn(
          'Address book hash verification failed during migration',
          e,
        );
      }

      // Clear hash and backup hash, items are preserved
      await simpleDb.addressBook.updateItemsAndHash({ items, hash: '' });
      await simpleDb.addressBook.clearBackupHash();
    });
  }

  // Legacy hash helpers (kept only for migration)

  private async _computeItemsHashLegacy(
    items: IAddressItem[],
    password: string,
  ): Promise<string> {
    const salt = await decodeSensitiveTextAsync({ encodedText: password });
    const itemString = stableStringify(items);
    return bufferUtils.bytesToHex(
      await hash160(bufferUtils.toBuffer(`${itemString}${salt}`, 'utf-8')),
    );
  }

  private async _verifyHashLegacy({
    itemsToVerify,
    password,
  }: {
    itemsToVerify: IAddressItem[];
    password: string;
  }): Promise<boolean> {
    const { simpleDb } = this.backgroundApi;
    const { hash } = await simpleDb.addressBook.getItemsAndHash();
    if (itemsToVerify.length === 0) {
      return true;
    }
    const itemsHash = await this._computeItemsHashLegacy(
      itemsToVerify,
      password,
    );
    if (itemsHash === hash) {
      return true;
    }
    const backupHash = await simpleDb.addressBook.getBackupHash();
    if (itemsHash === backupHash) {
      return true;
    }
    return false;
  }
}

export default ServiceAddressBook;
