// eslint-disable-next-line max-classes-per-file

import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

import type { IDBContext } from '../../types';
import type Realm from 'realm';

class RealmSchemaContext extends RealmObjectBase<IDBContext> {
  public id!: string;

  public nextHD!: number;

  public nextWalletNo!: number;

  public verifyString!: string;

  public networkOrderChanged?: boolean;

  public pendingWallets?: Realm.Set<string>;

  public backupUUID!: string;

  public static override schema: Realm.ObjectSchema = {
    name: ELocalDBStoreNames.Context,
    primaryKey: 'id',
    properties: {
      id: 'string',
      nextHD: 'int',
      nextWalletNo: 'int',
      verifyString: 'string',
      networkOrderChanged: { type: 'bool', default: false },
      pendingWallets: { type: 'set', objectType: 'string', default: [] },
      backupUUID: { type: 'string', default: '' },
    },
  };

  get record(): IDBContext {
    return {
      id: this.id,
      nextHD: this.nextHD,
      nextWalletNo: this.nextWalletNo,
      verifyString: this.verifyString,
      networkOrderChanged: this.networkOrderChanged || false,
      backupUUID: this.backupUUID,
    };
  }
}
export { RealmSchemaContext };
