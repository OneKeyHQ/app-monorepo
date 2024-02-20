import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

import type { IDBIndexedAccount } from '../../types';
import type Realm from 'realm';

class RealmSchemaIndexedAccount extends RealmObjectBase<IDBIndexedAccount> {
  public id!: string;

  public idHash!: string;

  public walletId!: string;

  public name!: string;

  public index!: number;

  public static override schema: Realm.ObjectSchema = {
    name: ELocalDBStoreNames.IndexedAccount,
    primaryKey: 'id',
    properties: {
      id: 'string',
      idHash: 'string',
      walletId: 'string',
      name: 'string',
      index: 'int',
    },
  };

  get record(): IDBIndexedAccount {
    return {
      id: this.id,
      idHash: this.idHash,
      walletId: this.walletId,
      name: this.name,
      index: this.index,
    };
  }
}

export { RealmSchemaIndexedAccount };
