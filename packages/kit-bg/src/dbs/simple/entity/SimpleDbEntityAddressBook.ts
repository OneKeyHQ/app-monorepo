import type { IAddressItem } from '@onekeyhq/kit/src/views/AddressBook/type';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface IAddressBookData {
  items: IAddressItem[];
  hash: string;
  backupHash: string;
}

export class SimpleDbEntityAddressBook extends SimpleDbEntityBase<IAddressBookData> {
  entityName = 'addressBookItems';

  override enableCache = false;

  updateItemsAndHash({ items, hash }: { items: IAddressItem[]; hash: string }) {
    return this.setRawData(({ rawData }) => ({
      items,
      hash,
      backupHash: rawData?.backupHash ?? '',
    }));
  }

  async getItemsAndHash(): Promise<{ items: IAddressItem[]; hash: string }> {
    const rawData = await this.getRawData();
    return { items: rawData?.items ?? [], hash: rawData?.hash ?? '' };
  }

  setBackupHash(text: string) {
    return this.setRawData(({ rawData }) => ({
      items: rawData?.items ?? [],
      hash: rawData?.hash ?? '',
      backupHash: text,
    }));
  }

  clearBackupHash() {
    return this.setBackupHash('');
  }

  async getBackupHash() {
    const rawData = await this.getRawData();
    return rawData?.backupHash ?? '';
  }
}
