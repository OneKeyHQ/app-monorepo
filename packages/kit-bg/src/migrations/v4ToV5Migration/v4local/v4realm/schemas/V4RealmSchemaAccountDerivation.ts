import { EV4LocalDBStoreNames } from '../../v4localDBStoreNames';
import { V4RealmObjectBase } from '../base/V4RealmObjectBase';

import type { IV4DBAccountDerivation } from '../../v4localDBTypes';
import type Realm from 'realm';

class V4RealmSchemaAccountDerivation extends V4RealmObjectBase<IV4DBAccountDerivation> {
  public id!: string;

  public walletId!: string;

  public accounts!: string[];

  public template!: string;

  public static override schema: Realm.ObjectSchema = {
    name: EV4LocalDBStoreNames.AccountDerivation,
    primaryKey: 'id',
    properties: {
      id: 'string',
      walletId: 'string',
      accounts: 'string[]',
      template: 'string',
    },
  };

  get record(): IV4DBAccountDerivation {
    return {
      id: this.id,
      walletId: this.walletId,
      accounts: Array.from(this.accounts || []),
      template: this.template,
    };
  }
}

export { V4RealmSchemaAccountDerivation };
