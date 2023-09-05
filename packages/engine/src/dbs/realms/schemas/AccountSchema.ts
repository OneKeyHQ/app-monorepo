import Realm from 'realm';

import { AccountType } from '../../../types/account';

import type { TokenSchema, WalletSchema } from '.';
import type {
  DBAccount,
  DBSimpleAccount,
  DBUTXOAccount,
  DBVariantAccount,
} from '../../../types/account';

class AccountSchema extends Realm.Object {
  public id!: string;

  public name!: string;

  public type!: AccountType;

  public path?: string;

  public coinType!: string;

  public pub?: string;

  public xpub?: string;

  public xpubSegwit?: string;

  public address?: string;

  public addresses?: Realm.Dictionary<string>;

  public customAddresses?: Realm.Dictionary<string>;

  public tokens?: Realm.Set<TokenSchema>;

  public assignee!: Realm.Results<WalletSchema>;

  public template?: string;

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
      xpubSegwit: 'string?',
      address: 'string?',
      addresses: { type: 'dictionary', default: {}, objectType: 'string' },
      customAddresses: {
        type: 'dictionary',
        default: {},
        objectType: 'string',
      },
      tokens: { type: 'Token<>', default: [] },
      assignee: {
        type: 'linkingObjects',
        objectType: 'Wallet',
        property: 'accounts',
      },
      template: 'string?',
    },
  };

  get internalObj(): DBAccount {
    const ret = {
      id: this.id,
      name: this.name,
      type: this.type,
      path: this.path || '',
      coinType: this.coinType,
      address: this.address || '',
      template: this.template || '',
    } as DBAccount;
    if (this.type === AccountType.SIMPLE) {
      (ret as DBSimpleAccount).pub = this.pub || '';
    } else if (this.type === AccountType.VARIANT) {
      (ret as DBVariantAccount).pub = this.pub || '';
      (ret as DBVariantAccount).addresses = this.addresses || {};
    } else if (this.type === AccountType.UTXO) {
      (ret as DBUTXOAccount).pub = this.pub || '';
      (ret as DBUTXOAccount).xpub = this.xpub || '';
      (ret as DBUTXOAccount).xpubSegwit = this.xpubSegwit || '';
      (ret as DBUTXOAccount).addresses = this.addresses || {};
      (ret as DBUTXOAccount).customAddresses = this.customAddresses || {};
    }
    return ret;
  }
}
export { AccountSchema };
