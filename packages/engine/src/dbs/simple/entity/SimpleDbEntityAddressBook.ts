import type {
  Contact,
  ContactBase,
} from '@onekeyhq/kit/src/views/AddressBook/types';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export type ISimpleDbEntityAddressbookData = {
  items: Contact[];
  uuid?: number;
};

export class SimpleDbEntityAddressBook extends SimpleDbEntityBase<ISimpleDbEntityAddressbookData> {
  entityName = 'addressbook';

  async setItems(items: Contact[]): Promise<void> {
    const rawData = await this.getRawData();
    this.setRawData({ ...rawData, items });
  }

  async getItems(): Promise<Contact[] | undefined> {
    const rawData = await this.getRawData();
    return rawData?.items;
  }

  async addItem(item: ContactBase): Promise<void> {
    const rawData = await this.getRawData();
    const items = rawData?.items || [];
    const uuid = rawData?.uuid || 0;
    const newUUID = uuid + 1;
    const newItems = { ...item, id: newUUID, createAt: Date.now() };
    items.unshift(newItems);
    await this.setRawData({ ...rawData, items, uuid: newUUID });
  }

  async removeItem(uuid: number): Promise<void> {
    const items = await this.getItems();
    if (items) {
      const newItems = items.filter((item) => item.id !== uuid);
      await this.setItems(newItems);
    }
  }

  async updateItem(uuid: number, item: ContactBase): Promise<void> {
    const items = await this.getItems();
    if (items) {
      const index = items.findIndex((o) => o.id === uuid);
      if (index >= 0) {
        const current = items[index];
        const newItem = { ...current, ...item };
        items.splice(index, 1, newItem);
        await this.setItems(items);
      }
    }
  }
}
