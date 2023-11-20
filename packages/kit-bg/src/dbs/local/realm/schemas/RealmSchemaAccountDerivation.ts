import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

import type { IDBAccountDerivation } from '../../types';
import type Realm from 'realm';

class RealmSchemaAccountDerivation extends RealmObjectBase<IDBAccountDerivation> {
  public id!: string;

  public walletId!: string;

  public accounts!: string[];

  public template!: string;

  public static override schema: Realm.ObjectSchema = {
    name: ELocalDBStoreNames.AccountDerivation,
    primaryKey: 'id',
    properties: {
      id: 'string',
      walletId: 'string',
      accounts: 'string[]',
      template: 'string',
    },
  };

  get record(): IDBAccountDerivation {
    return {
      id: this.id,
      walletId: this.walletId,
      accounts: this.accounts,
      template: this.template,
    };
  }
}

export { RealmSchemaAccountDerivation };
