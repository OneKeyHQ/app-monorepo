import Realm from 'realm';

import type { AccountSchema } from '.';
import type { DBAccountDerivation } from '../../../types/accountDerivation';

class AccountDerivationSchema extends Realm.Object {
  public id!: string;

  public walletId!: string;

  public accounts!: Realm.Set<AccountSchema>;

  public template!: string;

  public static schema: Realm.ObjectSchema = {
    name: 'AccountDerivation',
    primaryKey: 'id',
    properties: {
      id: 'string',
      walletId: 'string',
      accounts: { type: 'Account<>', default: [] },
      template: 'string',
    },
  };

  get internalObj(): DBAccountDerivation {
    return {
      id: this.id,
      walletId: this.walletId,
      accounts: (this.accounts || []).map((account) => account.id),
      template: this.template,
    };
  }
}

export { AccountDerivationSchema };
