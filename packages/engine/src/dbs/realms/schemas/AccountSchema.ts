import { TokenSchema, WalletSchema } from '.';

import Realm from 'realm';

import { AccountType } from '../../../types/account';

class AccountSchema extends Realm.Object {
  public id!: string;

  public name!: string;

  public type!: AccountType;

  public path?: string;

  public coinType!: string;

  public pub?: string;

  public xpub?: string;

  public address?: string;

  public addresses?: Realm.Set<string>;

  public tokens?: Realm.Set<TokenSchema>;

  public assignee!: Realm.Results<WalletSchema>;

  public static schema: Realm.ObjectSchema = {
    name: 'Account',
    primaryKey: 'id',
    properties: {
      id: 'string',
      name: 'string',
      type: 'string',
      path: 'string?',
      coinType: 'string',
      pub: 'string?',
      xpub: 'string?',
      address: 'string?',
      addresses: { type: 'string<>', default: [] },
      tokens: { type: 'Token<>', default: [] },
      assignee: {
        type: 'linkingObjects',
        objectType: 'Wallet',
        property: 'accounts',
      },
    },
  };
}
export { AccountSchema };
