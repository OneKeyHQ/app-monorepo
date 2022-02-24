import { AccountSchema } from '.';

import Realm from 'realm';

import { Wallet, WalletType } from '../../../types/wallet';

class WalletSchema extends Realm.Object {
  public id!: string;

  public name!: string;

  public type!: WalletType;

  public backuped?: boolean;

  public accounts?: Realm.Set<AccountSchema>;

  public nextAccountIds?: Realm.Dictionary<number>;

  public static schema: Realm.ObjectSchema = {
    name: 'Wallet',
    primaryKey: 'id',
    properties: {
      id: 'string',
      name: 'string',
      type: 'string',
      backuped: { type: 'bool', default: false },
      accounts: { type: 'Account<>', default: [] },
      nextAccountIds: {
        type: 'dictionary',
        default: {},
        objectType: 'int',
      },
    },
  };

  get internalObj(): Wallet {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      backuped: this.backuped || false,
      accounts: (this.accounts || []).map((account) => account.id),
      nextAccountIds: Object.fromEntries(
        Object.entries(Object(this.nextAccountIds)),
      ),
    };
  }
}

export { WalletSchema };
