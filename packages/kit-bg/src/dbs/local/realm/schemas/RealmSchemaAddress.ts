import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

import type { IDBAddress } from '../../types';
import type Realm from 'realm';

class RealmSchemaAddress extends RealmObjectBase<IDBAddress> {
  public id!: string;

  public wallets!: Realm.Dictionary<string>;

  public static override schema: Realm.ObjectSchema = {
    name: ELocalDBStoreNames.Address,
    primaryKey: 'id',
    properties: {
      id: 'string',
      wallets: { type: 'dictionary', default: {}, objectType: 'string' },
    },
  };

  get record(): IDBAddress {
    return {
      id: this.id,
      wallets: (this.wallets?.toJSON() as Record<string, string>) || {},
    };
  }
}

export { RealmSchemaAddress };
