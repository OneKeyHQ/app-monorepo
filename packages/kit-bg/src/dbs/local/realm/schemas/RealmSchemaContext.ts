// eslint-disable-next-line max-classes-per-file

import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

import type { OneKeyContext } from '../../types';
import type Realm from 'realm';

class RealmSchemaContext extends RealmObjectBase<OneKeyContext> {
  public id!: string;

  public nextHD!: number;

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
      verifyString: 'string',
      networkOrderChanged: { type: 'bool', default: false },
      pendingWallets: { type: 'set', objectType: 'string', default: [] },
      backupUUID: { type: 'string', default: '' },
    },
  };

  get record(): OneKeyContext {
    return {
      id: this.id,
      nextHD: this.nextHD,
      verifyString: this.verifyString,
      networkOrderChanged: this.networkOrderChanged || false,
      pendingWallets: (this.pendingWallets || []).map((walletId) => walletId),
      backupUUID: this.backupUUID,
    };
  }
}
export { RealmSchemaContext };
