import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

import type { IDBHardwareHomeScreen } from '../../types';
import type Realm from 'realm';

class RealmSchemaHardwareHomeScreen extends RealmObjectBase<IDBHardwareHomeScreen> {
  public id!: string;

  public deviceId!: string;

  public imgBase64!: string;

  public name!: string;

  public createdAt!: number;

  public static override schema: Realm.ObjectSchema = {
    name: ELocalDBStoreNames.HardwareHomeScreen,
    primaryKey: 'id',
    properties: {
      id: 'string',
      deviceId: 'string',
      imgBase64: 'string',
      name: 'string',
      createdAt: { type: 'int', indexed: true },
    },
  };

  get record(): IDBHardwareHomeScreen {
    return {
      id: this.id,
      deviceId: this.deviceId,
      imgBase64: this.imgBase64,
      name: this.name,
      createdAt: this.createdAt,
    };
  }
}

export { RealmSchemaHardwareHomeScreen };
