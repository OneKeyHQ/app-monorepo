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
    let v4items = await this.getV4AddressBookItems();
    if (v4items.length === 0) {
      return;
    }
    v4items = v4items.sort((a, b) => a.createAt - b.createAt);
    const v5items: IAddressItem[] = v4items.map((o) => {
      const item = {
        id: generateUUID(),
        address: o.address,
        name: o.name,
        networkId: o.networkId,
        createdAt: o.createAt,
      };
      return item;
    });
    await this.backgroundApi.serviceAddressBook.bulkSetItemsWithUniq(
      v5items,
      password,
    );
  }
}
