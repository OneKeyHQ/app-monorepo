import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

import type { IDBCredentialBase } from '../../types';
import type Realm from 'realm';

class RealmSchemaCredential extends RealmObjectBase<IDBCredentialBase> {
  public id!: string;

  public credential!: string;

  public static override schema: Realm.ObjectSchema = {
    name: ELocalDBStoreNames.Credential,
    primaryKey: 'id',
    properties: {
      id: 'string',
      credential: 'string',
    },
  };

  get record(): IDBCredentialBase {
    return {
      id: this.id,
      credential: this.credential,
    };
  }
}
export { RealmSchemaCredential };
