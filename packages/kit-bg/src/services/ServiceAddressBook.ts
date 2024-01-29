import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import type { IAddressItem } from '@onekeyhq/kit/src/common/components/AddressBook/type';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { addressBookPersistAtom } from '../states/jotai/atoms/addressBooks';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceAddressBook extends ServiceBase {
  rollbackData?: string;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private async getItemsAndPassword(): Promise<{
    items: IAddressItem[];
    password: string;
    encoded?: string;
  }> {
    const password =
      await this.backgroundApi.servicePassword.getCachedPassword();
    if (!password) {
      throw new Error('Password not found');
    }
    const data = await addressBookPersistAtom.get();
    let items: IAddressItem[] = [];
    if (data.encoded) {
      const text = decodeSensitiveText({
        encodedText: data.encoded,
        key: password,
      });
      items = JSON.parse(text) as IAddressItem[];
    }
    return { items, password, encoded: data.encoded };
  }

  @backgroundMethod()
  public async addAddressBookItem(newObj: IAddressItem) {
    const isValid = await this.backgroundApi.serviceAddress.validateAddress({
      networkId: newObj.networkId,
      address: newObj.address,
    });
    if (!isValid) {
      throw new Error('Invalid address');
    }
    const { items, password } = await this.getItemsAndPassword();
    const addressExist = await this.findItem({ address: newObj.address });
    if (addressExist) {
      throw new Error('Address already exist');
    }
    const nameExist = await this.findItem({ name: newObj.name });
    if (nameExist) {
      throw new Error('Name already exist');
    }
    newObj.id = generateUUID();
    items.push(newObj);
    const text = encodeSensitiveText({
      text: JSON.stringify(items),
      key: password,
    });
    await addressBookPersistAtom.set({ encoded: text });
  }

  @backgroundMethod()
  public async editAddressBookItem(obj: IAddressItem) {
    if (!obj.id) {
      throw new Error('Missing id');
    }
    const { items, password } = await this.getItemsAndPassword();
    const addressExist = await this.findItem({ address: obj.address });
    if (addressExist && addressExist.id !== obj.id) {
      throw new Error('Address already exist');
    }
    const nameExist = await this.findItem({ name: obj.name });
    if (nameExist && nameExist.id !== obj.id) {
      throw new Error('Name already exist');
    }
    const dataIndex = items.findIndex((i) => i.id === obj.id);
    if (dataIndex >= 0) {
      const data = items[dataIndex];
      const newObj = { ...data, ...obj };
      items[dataIndex] = newObj;
      const text = encodeSensitiveText({
        text: JSON.stringify(items),
        key: password,
      });
      await addressBookPersistAtom.set({ encoded: text });
    } else {
      throw new Error('Address Book Item not found');
    }
  }

  @backgroundMethod()
  public async removeAddressBookItem(id: string) {
    const { items, password } = await this.getItemsAndPassword();
    const data = items.filter((i) => i.id !== id);
    const text = encodeSensitiveText({
      text: JSON.stringify(data),
      key: password,
    });
    await addressBookPersistAtom.set({ encoded: text });
  }

  @backgroundMethod()
  public async getAddressBookItems(): Promise<IAddressItem[]> {
    const { items } = await this.getItemsAndPassword();
    return items;
  }

  public async updateAddressBookDb(newPassword: string) {
    const { items, encoded } = await this.getItemsAndPassword();
    const text = encodeSensitiveText({
      text: JSON.stringify(items),
      key: newPassword,
    });
    await addressBookPersistAtom.set({ encoded: text });
    this.rollbackData = encoded;
  }

  public async rollbackAddressBook() {
    if (this.rollbackData) {
      await addressBookPersistAtom.set({ encoded: this.rollbackData });
    } else {
      throw new Error('No rollback data');
    }
  }

  @backgroundMethod()
  public async findItem(params: {
    networkId?: string;
    address?: string;
    name?: string;
  }): Promise<IAddressItem | undefined> {
    if (!params.address && !params.name) {
      return undefined;
    }
    const { items } = await this.getItemsAndPassword();
    const item = items.find((i) => {
      let match = true;
      if (params.networkId) {
        match = i.networkId === params.networkId;
      }
      if (params.address) {
        match =
          match && i.address.toLowerCase() === params.address.toLowerCase();
      }
      if (params.name) {
        match = match && i.name.toLowerCase() === params.name.toLowerCase();
      }
      return match;
    });
    return item;
  }
}

export default ServiceAddressBook;
