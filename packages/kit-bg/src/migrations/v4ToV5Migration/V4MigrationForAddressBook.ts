import type { IAddressItem } from '@onekeyhq/kit/src/views/AddressBook/type';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { V4MigrationManagerBase } from './V4MigrationManagerBase';

import type { IV4ReduxContact } from './v4types/v4typesRedux';

export class V4MigrationForAddressBook extends V4MigrationManagerBase {
  private async getV4AddressBookItems(): Promise<IV4ReduxContact[]> {
    const reduxData = await this?.v4dbHubs?.v4reduxDb?.reduxData;
    if (!reduxData) {
      return [];
    }
    const contacts = reduxData?.contacts;
    if (!contacts) {
      return [];
    }
    return Object.values(contacts?.contacts || {});
  }

  async convertV4ContactsToV5(password: string) {
    let v4items = await this.getV4AddressBookItems();
    if (v4items.length === 0) {
      return;
    }
    v4items = v4items.sort((a, b) => a.createAt - b.createAt);

    const v5items: IAddressItem[] = [];
    for (const v4addressBookItem of v4items) {
      await this.v4dbHubs.logger.runAsyncWithCatch(
        async () => {
          const network =
            await this.backgroundApi.serviceNetwork.getNetworkSafe({
              networkId: v4addressBookItem.networkId,
            });
          if (network) {
            const v5item: IAddressItem = {
              id: generateUUID(),
              address: v4addressBookItem.address,
              name: v4addressBookItem.name,
              networkId: v4addressBookItem.networkId,
              createdAt: v4addressBookItem.createAt,
            };
            v5items.push(v5item);
            return v5item;
          }
          throw new Error(
            `network not support: ${v4addressBookItem.networkId}`,
          );
        },
        {
          name: 'migration address book item',
          logResultFn: (result) =>
            `${result?.name || ''} ${result?.address || ''}`,
          errorResultFn: () => undefined,
        },
      );
    }

    await this.backgroundApi.serviceAddressBook.bulkSetItemsWithUniq(
      v5items,
      password,
    );
  }
}
