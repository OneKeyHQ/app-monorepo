import { EV4LocalDBStoreNames } from '../../v4localDBStoreNames';
import { V4RealmObjectBase } from '../base/V4RealmObjectBase';

import type { IV4DBCredentialBase } from '../../v4localDBTypes';
import type Realm from 'realm';

class V4RealmSchemaCredential extends V4RealmObjectBase<IV4DBCredentialBase> {
  public id!: string;

  public credential!: string;

  public static override schema: Realm.ObjectSchema = {
    name: EV4LocalDBStoreNames.Credential,
    primaryKey: 'id',
    properties: {
      id: 'string',
      credential: 'string',
    },
  };

  get record(): IV4DBCredentialBase {
    return {
      id: this.id,
      credential: this.credential,
    };
  }
}
export { V4RealmSchemaCredential };
