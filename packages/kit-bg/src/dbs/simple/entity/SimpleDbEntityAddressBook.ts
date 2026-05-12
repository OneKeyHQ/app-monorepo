import type { IAddressItem } from '@onekeyhq/kit/src/views/AddressBook/type';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IAddressBookData {
  items: IAddressItem[];
  hash: string;
  backupHash: string;
}

export class SimpleDbEntityAddressBook extends SimpleDbEntityBase<IAddressBookData> {
  entityName = 'addressBookItems';

  override enableCache = false;

  // Primary methods (hash-free)

  updateItems(items: IAddressItem[]) {
    return this.setRawData(() => ({
      items,
      hash: '',
      backupHash: '',
    }));
  }

  async getItems(): Promise<IAddressItem[]> {
    const rawData = await this.getRawData();
    return rawData?.items ?? [];
  }

  // Legacy methods (kept for migration compatibility)

  updateItemsAndHash({ items, hash }: { items: IAddressItem[]; hash: string }) {
    return this.setRawData((rawData) => ({
      items,
      hash,
      backupHash: rawData?.backupHash ?? '',
    }));
  }

  async getItemsAndHash(): Promise<{ items: IAddressItem[]; hash: string }> {
    const rawData = await this.getRawData();
    return { items: rawData?.items ?? [], hash: rawData?.hash ?? '' };
  }

  clearBackupHash() {
    return this.setRawData((rawData) => ({
      items: rawData?.items ?? [],
      hash: rawData?.hash ?? '',
      backupHash: '',
    }));
  }

  async getBackupHash() {
    const rawData = await this.getRawData();
    return rawData?.backupHash ?? '';
  }
}
