import Realm from 'realm';

import type { AccountSchema, WalletSchema } from '.';
import type { DBAccountDerivation } from '../../../types/accountDerivation';

class AccountDerivationSchema extends Realm.Object {
  public id!: string;

  public walletId!: WalletSchema;

  public accounts!: Realm.Set<AccountSchema>;

  public template!: string;

  public static schema: Realm.ObjectSchema = {
    name: 'AccountDerivation',
    primaryKey: 'id',
    properties: {
      id: 'string',
      walletId: 'Wallet',
      accounts: { type: 'Account<>', default: [] },
      teamplate: 'string',
      createdAt: 'int',
      updatedAt: 'int',
    },
  };

  get internalObj(): DBAccountDerivation {
    return {
      id: this.id,
      walletId: this.walletId.id,
      accounts: (this.accounts || []).map((account) => account.id),
      template: this.template,
    };
  }
}

export { AccountDerivationSchema };
