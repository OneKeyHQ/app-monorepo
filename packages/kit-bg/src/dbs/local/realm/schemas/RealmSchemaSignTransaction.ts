import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

import type { IDBSignedTransaction } from '../../types';
import type Realm from 'realm';

class RealmSchemaSignTransaction extends RealmObjectBase<IDBSignedTransaction> {
  public id!: string;

  public networkId!: string;

  public title!: string;

  public address!: string;

  public dataStringify!: string;

  public hash!: string;

  public createdAt!: number;

  public static override schema: Realm.ObjectSchema = {
    name: ELocalDBStoreNames.SignedTransaction,
    primaryKey: 'id',
    properties: {
      id: 'string',
      networkId: 'string',
      title: 'string',
      address: 'string',
      dataStringify: 'string',
      hash: 'string',
      createdAt: 'int',
    },
  };

  get record(): IDBSignedTransaction {
    return {
      id: this.id,
      title: this.title,
      networkId: this.networkId,
      address: this.address,
      dataStringify: this.dataStringify,
      hash: this.hash,
      createdAt: this.createdAt,
    };
  }
}

export { RealmSchemaSignTransaction };
