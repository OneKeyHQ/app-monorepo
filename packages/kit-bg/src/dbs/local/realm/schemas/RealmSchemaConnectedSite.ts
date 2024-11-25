import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

import type { IDBConnectedSite } from '../../types';
import type Realm from 'realm';

class RealmSchemaConnectedSite extends RealmObjectBase<IDBConnectedSite> {
  public id!: string;

  public networkIds!: string[];

  public addresses!: string[];

  public url!: string;

  public createdAt!: number;

  public static override schema: Realm.ObjectSchema = {
    name: ELocalDBStoreNames.ConnectedSite,
    primaryKey: 'id',
    properties: {
      id: 'string',
      networkIds: 'string[]',
      addresses: 'string[]',
      url: 'string',
      createdAt: { type: 'int', indexed: true },
    },
  };

  get record(): IDBConnectedSite {
    return {
      id: this.id,
      networkIds: Array.from(this.networkIds || []),
      addresses: Array.from(this.addresses || []),
      url: this.url,
      createdAt: this.createdAt,
    };
  }
}

export { RealmSchemaConnectedSite };
