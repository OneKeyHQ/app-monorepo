// eslint-disable-next-line max-classes-per-file

import { EV4LocalDBStoreNames } from '../../v4localDBStoreNames';
import { V4RealmObjectBase } from '../base/V4RealmObjectBase';

import type { IV4DBContext } from '../../v4localDBTypes';
import type Realm from 'realm';

class V4RealmSchemaContext extends V4RealmObjectBase<IV4DBContext> {
  public id!: string;

  public nextHD!: number;

  public verifyString!: string;

  public networkOrderChanged?: boolean;

  public pendingWallets?: Realm.Set<string>;

  public backupUUID!: string;

  public static override schema: Realm.ObjectSchema = {
    name: EV4LocalDBStoreNames.Context,
    primaryKey: 'id',
    properties: {
      id: 'string',
      nextHD: 'int',
      verifyString: 'string',
      networkOrderChanged: { type: 'bool', default: false },
      pendingWallets: {
        // type: 'string<>',
        type: 'set',
        objectType: 'string',
        default: [],
      },
      backupUUID: { type: 'string', default: '' },
    },
  };

  get record(): IV4DBContext {
    return {
      id: this.id,
      nextHD: this.nextHD,
      verifyString: this.verifyString,
      networkOrderChanged: this.networkOrderChanged || false,
      backupUUID: this.backupUUID,
      pendingWallets: Array.from(this.pendingWallets || []),
    };
  }
}
export { V4RealmSchemaContext };
