import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import { hash160 } from '@onekeyhq/core/src/secret/hash';
import type {
  IAddressItem,
  ISectionItem,
} from '@onekeyhq/kit/src/views/AddressBook/type';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { addressBookPersistAtom } from '../states/jotai/atoms/addressBooks';

import ServiceBase from './ServiceBase';

function getSectionItemScore(item: ISectionItem): number {
  if (item.title.toLowerCase() === 'bitcoin') {
    return -10;
  }
  if (item.title.toLowerCase() === 'evm') {
    return -9;
  }
  return item.data[0]?.createdAt ?? 0;
}

@backgroundClass()
class ServiceAddressBook extends ServiceBase {
  // if verifyHash successfully, update verifyHashTimestamp for cache result
  verifyHashTimestamp?: number;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private computeItemsHash(items: IAddressItem[], password: string): string {
    const salt = decodeSensitiveText({ encodedText: password });
    const itemString = stableStringify(items);
    return bufferUtils.bytesToHex(
      hash160(bufferUtils.toBuffer(`${itemString}${salt}`, 'utf-8')),
    );
  }

  private async setItems(
    items: IAddressItem[],
    password: string,
  ): Promise<void> {
    const { simpleDb } = this.backgroundApi;
    const hash = this.computeItemsHash(items, password);
    await simpleDb.addressBook.updateItemsAndHash({ items, hash });
    this.verifyHashTimestamp = undefined;
    await addressBookPersistAtom.set((prev) => ({
      ...prev,
      updateTimestamp: Date.now(),
    }));
  }

  private async getItems(): Promise<IAddressItem[]> {
    const { simpleDb } = this.backgroundApi;
    const { items } = await simpleDb.addressBook.getItemsAndHash();
    return items;
  }

  private async _verifyHash(): Promise<boolean> {
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
    return false;
  }

  // verify hash with cache
  public async verifyHash(returnValue?: boolean): Promise<boolean> {
    const now = Date.now();
    const timestamp = this.verifyHashTimestamp;
    if (
      timestamp &&
      now - timestamp < timerUtils.getTimeDurationMs({ minute: 30 })
    ) {
      return true;
    }
    const result = await this._verifyHash();
    if (result) {
      this.verifyHashTimestamp = now;
      return true;
    }
    if (returnValue) {
      return false;
    }
    throw new Error('address book failed to verify hash');
  }

  getItemGroupName(item: IAddressItem, names: Record<string, string>) {
    return item.networkId.startsWith('evm--') ? 'EVM' : names[item.networkId];
  }

  @backgroundMethod()
  async groupItems({ networkId }: { networkId?: string }) {
    const { serviceNetwork } = this.backgroundApi;
    let items = await this.getItems();
    const names = await serviceNetwork.getNetworkNames();
    if (networkId) {
      const [impl] = networkId.split('--');
      items = items.filter((item) => item.networkId.startsWith(`${impl}--`));
    }
    const data = items.reduce((result, item) => {
      const title = this.getItemGroupName(item, names);
      if (!result[title]) {
        result[title] = [];
      }
      result[title].push(item);
      return result;
    }, {} as Record<string, IAddressItem[]>);
    return (
      Object.entries(data)
        .map((o) => ({ title: o[0], data: o[1] }))
        // pin up btc, evm to top, other impl sort by create time
        .sort((a, b) => getSectionItemScore(a) - getSectionItemScore(b))
    );
  }

  @backgroundMethod()
  async getSafeItems({ networkId }: { networkId?: string }) {
    const groupItems = await this.groupItems({ networkId });
    const isSafe = await this.verifyHash(true);
    return { isSafe, items: isSafe ? groupItems : [] };
  }

  @backgroundMethod()
  async __dangerTamperVerifyHashForTest() {
    if (!platformEnv.isDev) {
      return;
    }
    const items = await this.getItems();
    await this.setItems(
      items,
      encodeSensitiveText({ text: String(Date.now()) }),
    );
  }

  @backgroundMethod()
  async dangerClearDataForE2E() {
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerify();
    await this.setItems([], password);
    await addressBookPersistAtom.set((prev) => ({
      ...prev,
      updateTimestamp: undefined,
    }));
  }

  @backgroundMethod()
  async resetItems() {
    const verifyResult = await this.verifyHash(true);
    if (verifyResult) {
      throw new Error('failed to reset items when verify result is ok');
    }
    const { servicePassword } = this.backgroundApi;
    const { password } = await servicePassword.promptPasswordVerify();
    await this.setItems([], password);
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

  @backgroundMethod()
  public async stringifyItems() {
    const { serviceNetwork } = this.backgroundApi;
    const items = await this.getItems();
    const names = await serviceNetwork.getNetworkNames();
    const result: string[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const text = `${this.getItemGroupName(item, names)} ${item.name} ${
        item.address
      }`;
      result.push(text);
    }
    return result.join('\n');
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
}

export default ServiceAddressBook;
