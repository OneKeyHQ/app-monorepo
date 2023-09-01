import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { setMigrate } from '@onekeyhq/kit/src/store/reducers/contacts';
import type { ContactBase } from '@onekeyhq/kit/src/views/AddressBook/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceAddressbook extends ServiceBase {
  @backgroundMethod()
  async getItems() {
    const contacts = await simpleDb.addressbook.getItems();
    return contacts ?? [];
  }

  @backgroundMethod()
  async getItem(params: { address: string }) {
    const contacts = await simpleDb.addressbook.getItems();
    if (contacts) {
      return contacts.find(
        (item) => item.address.toLowerCase() === params.address.toLowerCase(),
      );
    }
  }

  @backgroundMethod()
  async migrate() {
    const { appSelector, dispatch } = this.backgroundApi;
    const migrate = appSelector((s) => s.contacts.migrate);
    if (migrate) {
      return;
    }
    const rawData = await simpleDb.addressbook.getRawData();
    let initalUuid = 0;
    if (rawData && rawData.uuid) {
      initalUuid = rawData.uuid;
    }
    const contacts = appSelector((s) => s.contacts.contacts);
    const objs = Object.values(contacts).sort(
      (a, b) => b.createAt - a.createAt,
    );
    const items = objs.map((item, i) => ({
      ...item,
      id: initalUuid + i + 1,
    }));
    const uuid = items.length + initalUuid;
    debugLogger.common.info('migrate', { items, uuid });
    await simpleDb.addressbook.setRawData({ items, uuid });
    dispatch(setMigrate(true));
  }

  @backgroundMethod()
  addItem(item: ContactBase) {
    return simpleDb.addressbook.addItem(item);
  }

  @backgroundMethod()
  removeItem(uuid: number) {
    return simpleDb.addressbook.removeItem(uuid);
  }

  @backgroundMethod()
  updateItem(uuid: number, item: ContactBase) {
    return simpleDb.addressbook.updateItem(uuid, item);
  }
}

export default ServiceAddressbook;
