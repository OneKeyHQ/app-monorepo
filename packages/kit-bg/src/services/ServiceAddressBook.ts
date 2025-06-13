import { Semaphore } from 'async-mutex';

import {
  decodeSensitiveTextAsync,
  encodeSensitiveTextAsync,
} from '@onekeyhq/core/src/secret';
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { type IDBCloudSyncItem } from '../dbs/local/types';
import { addressBookPersistAtom } from '../states/jotai/atoms/addressBooks';
import { devSettingsPersistAtom } from '../states/jotai/atoms/devSettings';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceAddressBook extends ServiceBase {
  // if verifyHash successfully, update verifyHashTimestamp for cache result
  verifyHashTimestamp?: number;

  mutex = new Semaphore(1);

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private async computeItemsHash(
    items: IAddressItem[],
    password: string,
  ): Promise<string> {
    const salt = await decodeSensitiveTextAsync({ encodedText: password });
    const itemString = stableStringify(items);
    return bufferUtils.bytesToHex(
      await hash160(bufferUtils.toBuffer(`${itemString}${salt}`, 'utf-8')),
    );
  }

  private async setItems({
    items,
    password,
    skipEventEmit,
  }: {
    items: IAddressItem[];
    password: string;
    skipEventEmit?: boolean;
  }): Promise<void> {
    const { simpleDb } = this.backgroundApi;
    const hash = await this.computeItemsHash(items, password);
    await simpleDb.addressBook.updateItemsAndHash({ items, hash });
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

  private async _verifyHash({
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
    const itemsHash = await this.computeItemsHash(itemsToVerify, password);
    if (itemsHash === hash) {
      return true;
    }
    const backupHash = await simpleDb.addressBook.getBackupHash();
    if (itemsHash === backupHash) {
      return true;
    }
    return false;
  }

  verifyHashMutex = new Semaphore(1);

  // verify hash with cache
  public async verifyHash({
    returnValue,
    password,
  }: {
    returnValue?: boolean; // return value if true, throw error if false
    password: string;
  }): Promise<boolean> {
    return this.verifyHashMutex.runExclusive(async () => {
      const now = Date.now();
      const timestamp = this.verifyHashTimestamp;
      if (
        timestamp &&
        now - timestamp < timerUtils.getTimeDurationMs({ minute: 30 })
      ) {
        return true;
      }
      if (!password) {
        throw new OneKeyLocalError(
          'addressBook verifyHash ERROR: password is required',
        );
      }

      const { items } =
        await this.backgroundApi.simpleDb.addressBook.getItemsAndHash();

      const result = await this._verifyHash({
        itemsToVerify: items,
        password,
      });
      if (result) {
        this.verifyHashTimestamp = now;
        return true;
      }
      if (returnValue) {
        return false;
      }
      throw new OneKeyLocalError('address book failed to verify hash');
    });
  }

  @backgroundMethod()
  async getSafeRawItems({
    throwErrorIfNotSafe,
    password,
  }: {
    throwErrorIfNotSafe?: boolean;
    password: string;
  }): Promise<{ isSafe: boolean; items: IAddressItem[] }> {
    const isSafe = await this.verifyHash({ returnValue: true, password });
    if (throwErrorIfNotSafe && !isSafe) {
      throw new OneKeyLocalError('address book failed to verify hash');
    }
    const items = await this.getItems();
    return { isSafe, items: isSafe ? items : [] };
  }

  @backgroundMethod()
  @toastIfError()
  async getSafeItems(params: {
    networkId?: string;
    exact?: boolean;
    password: string;
  }): Promise<{ isSafe: boolean; items: IAddressNetworkItem[] }> {
    const { networkId, exact, password } = params;
    // throw new OneKeyLocalError('address book failed to verify hash');
    const isSafe: boolean = await this.verifyHash({
      returnValue: true,
      password,
    });
    if (!isSafe) {
      return { isSafe, items: [] };
    }
    let { items: rawItems } = await this.getSafeRawItems({ password });
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
    return { isSafe, items };
  }

  @backgroundMethod()
  async __dangerTamperVerifyHashForTest() {
    const { enabled } = await devSettingsPersistAtom.get();
    if (platformEnv.isDev || enabled) {
      const items = await this.getItems();
      await this.setItems({
        items,
        password: await encodeSensitiveTextAsync({ text: String(Date.now()) }),
      });
    }
  }

  @backgroundMethod()
  async resetItems() {
    await this.mutex.runExclusive(async () => {
      const { servicePassword } = this.backgroundApi;
      const { password } = await servicePassword.promptPasswordVerify({
        reason: EReasonForNeedPassword.Security,
      });
      const verifyResult = await this.verifyHash({
        returnValue: true,
        password,
      });
      if (verifyResult) {
        throw new OneKeyLocalError(
          'failed to reset items when verify result is ok',
        );
      }
      await this.setItems({
        items: [],
        password,
      });
    });
  }

  private async validateItem(
    item: IAddressItem,
    { password }: { password: string },
  ) {
    const { serviceValidator } = this.backgroundApi;
    if (item.name.length > 24) {
      throw new OneKeyLocalError('Name is too long');
    }
    let result = await this.findItem({ address: item.address, password });
    if (result && (!item.id || result.id !== item.id)) {
      throw new OneKeyLocalError('Address already exist');
    }
    result = await this.findItem({ name: item.name, password });
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
      password: string;
      skipSaveLocalSyncItem: boolean | undefined;
      skipEventEmit: boolean | undefined;
    },
  ) {
    await this.mutex.runExclusive(async () => {
      const { items } = await this.getSafeRawItems({
        throwErrorIfNotSafe: true,
        password: options.password,
      });
      newObj.id = newObj.id || generateUUID();
      newObj.createdAt = newObj.createdAt || Date.now();
      newObj.updatedAt = newObj.updatedAt || Date.now();
      items.push(newObj);

      await this.withAddressBookCloudSync({
        fn: async () => {
          await this.setItems({
            items,
            password: options.password,
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
    const { servicePassword } = this.backgroundApi;
    const { password } = await servicePassword.promptPasswordVerify({
      reason: EReasonForNeedPassword.Security,
    });

    await this.validateItem(newObj, { password });
    await this.verifyHash({ password });

    await this.addItemFn(newObj, {
      ...options,
      password,
      skipSaveLocalSyncItem: options.skipSaveLocalSyncItem,
      skipEventEmit: options.skipEventEmit,
    });
  }

  async updateItemFn(
    obj: IAddressItem,
    options: {
      password: string;
      skipSaveLocalSyncItem: boolean | undefined;
      skipEventEmit: boolean | undefined;
    },
  ) {
    await this.mutex.runExclusive(async () => {
      const { items } = await this.getSafeRawItems({
        throwErrorIfNotSafe: true,
        password: options.password,
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
              password: options.password,
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
    const { servicePassword } = this.backgroundApi;
    const { password } = await servicePassword.promptPasswordVerify({
      reason: EReasonForNeedPassword.Security,
    });

    await this.validateItem(obj, { password });
    await this.verifyHash({ password });

    await this.updateItemFn(obj, {
      ...options,
      password,
      skipSaveLocalSyncItem: options.skipSaveLocalSyncItem,
      skipEventEmit: options.skipEventEmit,
    });
  }

  async removeItemFn(
    removedItem: IAddressItem,
    options: {
      password: string;
      skipSaveLocalSyncItem: boolean | undefined;
      skipEventEmit: boolean | undefined;
    },
  ) {
    await this.mutex.runExclusive(async () => {
      const { items } = await this.getSafeRawItems({
        throwErrorIfNotSafe: true,
        password: options.password,
      });
      await this.withAddressBookCloudSync({
        fn: async () => {
          const data = items.filter((i) => i.id !== removedItem.id);
          await this.setItems({
            items: data,
            password: options.password,
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
    const { servicePassword } = this.backgroundApi;
    const { password } = await servicePassword.promptPasswordVerify({
      reason: EReasonForNeedPassword.Security,
    });

    await this.verifyHash({ password });

    const { items } = await this.getSafeRawItems({ password });
    const removedItem = items.find((i) => i.id === id);
    if (!removedItem) {
      throw new OneKeyLocalError(`Failed to find item with id = ${id}`);
    }

    return this.removeItemFn(removedItem, {
      ...options,
      password,
      skipSaveLocalSyncItem: options.skipSaveLocalSyncItem,
      skipEventEmit: options.skipEventEmit,
    });
  }

  @backgroundMethod()
  public async findItem(params: {
    password: string;
    networkImpl?: string;
    networkId?: string;
    address?: string;
    name?: string;
  }): Promise<IAddressItem | undefined> {
    const { address, name, networkId, networkImpl, password } = params;

    const { items } = await this.getSafeRawItems({ password });

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
  public async findItemById({
    id,
    password,
  }: {
    id: string;
    password: string;
  }): Promise<IAddressItem | undefined> {
    const { items } = await this.getSafeRawItems({ password });
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

  public async updateHash(newPassword: string) {
    await this.mutex.runExclusive(async () => {
      const { simpleDb } = this.backgroundApi;
      const { items, hash } = await simpleDb.addressBook.getItemsAndHash();
      // save backup hash
      await simpleDb.addressBook.setBackupHash(hash);
      // save items with new password
      await this.setItems({
        items,
        password: newPassword,
      });
    });
  }

  public async finishUpdateHash() {
    const { simpleDb } = this.backgroundApi;
    await simpleDb.addressBook.clearBackupHash();
  }

  public async rollback(oldPassword: string) {
    await this.mutex.runExclusive(async () => {
      const { simpleDb } = this.backgroundApi;
      const { items } = await this.getSafeRawItems({
        password: oldPassword,
        throwErrorIfNotSafe: true,
      });
      await this.setItems({
        items,
        password: oldPassword,
      });
      await simpleDb.addressBook.clearBackupHash();
    });
  }

  @backgroundMethod()
  public async hideDialogInfo() {
    const { servicePassword } = this.backgroundApi;
    const passwordSet = await servicePassword.checkPasswordSet();
    if (!passwordSet) {
      return;
    }
    await addressBookPersistAtom.set((prev) => ({
      ...prev,
      hideDialogInfo: true,
    }));
  }

  // for Migration
  @backgroundMethod()
  async bulkSetItemsWithUniq(items: IAddressItem[], password: string) {
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
        password,
      });
    });
  }
}

export default ServiceAddressBook;
