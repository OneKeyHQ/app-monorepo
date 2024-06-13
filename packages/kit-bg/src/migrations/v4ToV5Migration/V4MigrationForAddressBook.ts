import type { IAddressItem } from '@onekeyhq/kit/src/views/AddressBook/type';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { V4MigrationManagerBase } from './V4MigrationManagerBase';

import type { IV4ReduxContact } from './v4types/v4typesRedux';

export class V4MigrationForAddressBook extends V4MigrationManagerBase {
  private async getV4AddressBookItems(): Promise<IV4ReduxContact[]> {
    const reduxData = await this.v4dbHubs.v4reduxDb.reduxData;
    if (!reduxData) {
      return [];
    }
    const contacts = reduxData.contacts;
    if (!contacts) {
      return [];
    }
    return Object.values(contacts.contacts);
  }

  async convertV4ContactsToV5(password: string) {
    let items = await this.getV4AddressBookItems();
    if (items.length === 0) {
      return;
    }
    items = items.sort((a, b) => a.createAt - b.createAt);
    const addressItems = items.map((o) => {
      const item = {
        id: generateUUID(),
        address: o.address,
        name: o.name,
        networkId: o.networkId,
        createdAt: o.createAt,
      } as IAddressItem;
      return item;
    });
    await this.backgroundApi.serviceAddressBook.migrationV4Items(
      addressItems,
      password,
    );
  }
}
