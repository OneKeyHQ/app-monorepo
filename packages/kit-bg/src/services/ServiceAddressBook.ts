import { sha256 } from '@onekeyhq/core/src/secret/hash';
import type {
  IAddressItem,
  ISectionItem,
} from '@onekeyhq/kit/src/common/components/AddressBook/type';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';

import { addressBookPersistAtom } from '../states/jotai/atoms/addressBooks';

import ServiceBase from './ServiceBase';

function getSectionItemScore(item: ISectionItem): number {
  if (item.title === 'btc') {
    return -10;
  }
  if (item.title === 'evm') {
    return -9;
  }
  return 0;
}

@backgroundClass()
class ServiceAddressBook extends ServiceBase {
  rollbackData?: string;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private computeItemsHash(items: IAddressItem[], password: string): string {
    const itemString = stableStringify(items);
    return bufferUtils.bytesToHex(
      sha256(bufferUtils.toBuffer(`${itemString}${password}`)),
    );
  }

  private async setItems(
    items: IAddressItem[],
    password: string,
  ): Promise<void> {
    const { simpleDb } = this.backgroundApi;
    const hash = this.computeItemsHash(items, password);
    await addressBookPersistAtom.set((prev) => ({
      ...prev,
      updateTimestamp: Date.now(),
    }));
    await simpleDb.addressBook.updateItemsAndHash({ items, hash });
  }

  @backgroundMethod()
  async getItems(): Promise<IAddressItem[]> {
    const { simpleDb } = this.backgroundApi;
    const { items } = await simpleDb.addressBook.getItemsAndHash();
    return items;
  }

  @backgroundMethod()
  async groupItems({ networkId }: { networkId?: string }) {
    let items = await this.getItems();
    if (networkId) {
      items = items.filter((item) => item.networkId === networkId);
    }
    const data = items.reduce((result, item) => {
      const [impl] = item.networkId.split('--');
      if (!result[impl]) {
        result[impl] = [];
      }
      result[impl].push(item);
      return result;
    }, {} as Record<string, IAddressItem[]>);
    return (
      Object.entries(data)
        .map((o) => ({ title: o[0], data: o[1] }))
        // order by btc/evm/other coin
        .sort((a, b) => getSectionItemScore(a) - getSectionItemScore(b))
    );
  }

  private async validateItem(item: IAddressItem) {
    const { serviceAccountProfile } = this.backgroundApi;
    if (item.name.length > 24) {
      return new Error('Name is too long');
    }
    let result = await this.findItem({ address: item.address });
    if (result && (!item.id || result.id !== item.id)) {
      throw new Error('Address already exist');
    }
    result = await this.findItem({ name: item.name });
    if (result && (!item.id || result.id !== item.id)) {
      throw new Error('Name already exist');
    }
    const isValid = await serviceAccountProfile.validateAddress({
      networkId: item.networkId,
      address: item.address,
    });
    if (!isValid) {
      throw new Error('Invalid address');
    }
  }

  @backgroundMethod()
  public async addItem(newObj: IAddressItem) {
    const { servicePassword } = this.backgroundApi;
    await this.validateItem(newObj);
    await this.verifyHash();
    const items = await this.getItems();
    newObj.id = generateUUID();
    newObj.createdAt = Date.now();
    newObj.updatedAt = Date.now();
    items.push(newObj);
    const { password } = await servicePassword.promptPasswordVerify();
    await this.setItems(items, password);
  }

  @backgroundMethod()
  public async updateItem(obj: IAddressItem) {
    if (!obj.id) {
      throw new Error('Missing id');
    }
    await this.validateItem(obj);
    await this.verifyHash();
    const { servicePassword } = this.backgroundApi;
    const items = await this.getItems();
    const dataIndex = items.findIndex((i) => i.id === obj.id);
    if (dataIndex >= 0) {
      const data = items[dataIndex];
      const newObj = { ...data, ...obj };
      newObj.updatedAt = Date.now();
      items[dataIndex] = newObj;
      const { password } = await servicePassword.promptPasswordVerify();
      await this.setItems(items, password);
    } else {
      throw new Error(`Failed to find item with id = ${obj.id}`);
    }
  }

  @backgroundMethod()
  public async removeItem(id: string) {
    await this.verifyHash();
    const { servicePassword } = this.backgroundApi;
    const { password } = await servicePassword.promptPasswordVerify();
    const items = await this.getItems();
    const data = items.filter((i) => i.id !== id);
    await this.setItems(data, password);
  }

  @backgroundMethod()
  public async findItem(params: {
    networkId?: string;
    address?: string;
    name?: string;
  }): Promise<IAddressItem | undefined> {
    const { address, name, networkId } = params;
    if (!address && !name && !networkId) {
      return undefined;
    }
    const items = await this.getItems();
    const item = items.find((i) => {
      let match = true;
      if (networkId) {
        match = i.networkId === networkId;
      }
      if (address) {
        match = match && i.address.toLowerCase() === address.toLowerCase();
      }
      if (name) {
        match = match && i.name.toLowerCase() === name.toLowerCase();
      }
      return match;
    });
    return item;
  }

  public async updateHash(newPassword: string) {
    const { simpleDb } = this.backgroundApi;
    const { items, hash } = await simpleDb.addressBook.getItemsAndHash();
    // save backup hash
    await simpleDb.addressBook.setBackupHash(hash);
    // save items with new password
    await this.setItems(items, newPassword);
  }

  public async finishUpdateHash() {
    const { simpleDb } = this.backgroundApi;
    await simpleDb.addressBook.clearBackupHash();
  }

  public async rollback(oldPassword: string) {
    const { simpleDb } = this.backgroundApi;
    const items = await this.getItems();
    await this.setItems(items, oldPassword);
    await simpleDb.addressBook.clearBackupHash();
  }

  @backgroundMethod()
  public async verifyHash(): Promise<boolean> {
    const { simpleDb, servicePassword } = this.backgroundApi;
    const { items, hash } = await simpleDb.addressBook.getItemsAndHash();
    if (items.length === 0) {
      return true;
    }
    const { password } = await servicePassword.promptPasswordVerify();
    const currentHash = this.computeItemsHash(items, password);
    if (currentHash === hash) {
      return true;
    }
    const backupHash = await simpleDb.addressBook.getBackupHash();
    if (currentHash === backupHash) {
      return true;
    }
    throw new Error('address book items is incorrect');
  }

  @backgroundMethod()
  public async setVisited() {
    await addressBookPersistAtom.set((prev) => ({ ...prev, visited: true }));
  }
}

export default ServiceAddressBook;
