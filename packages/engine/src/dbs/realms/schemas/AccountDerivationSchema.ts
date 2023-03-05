import Realm from 'realm';

import type { DBAccountDerivation } from '../../../types/accountDerivation';

class AccountDerivationSchema extends Realm.Object {
  public id!: string;

  public walletId!: string;

  public accounts!: string[];

  public template!: string;

  public static schema: Realm.ObjectSchema = {
    name: 'AccountDerivation',
    primaryKey: 'id',
    properties: {
      id: 'string',
      walletId: 'string',
      accounts: 'string[]',
      template: 'string',
    },
  };

  get internalObj(): DBAccountDerivation {
    return {
      id: this.id,
      walletId: this.walletId,
      accounts: this.accounts,
      template: this.template,
    };
  }
}

export { AccountDerivationSchema };
