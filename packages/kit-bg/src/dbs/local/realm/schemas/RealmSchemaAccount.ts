import { AccountType } from '../../consts';
import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

import type { RealmSchemaWallet } from './RealmSchemaWallet';
import type {
  DBAccount,
  DBSimpleAccount,
  DBUTXOAccount,
  DBVariantAccount,
} from '../../types';
import type Realm from 'realm';

class RealmSchemaAccount extends RealmObjectBase<DBAccount> {
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

  public assignee!: Realm.Results<RealmSchemaWallet>;

  public template?: string;

  public static override schema: Realm.ObjectSchema = {
    name: ELocalDBStoreNames.Account,
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
      assignee: {
        type: 'linkingObjects',
        objectType: 'Wallet',
        property: 'accounts',
      },
      template: 'string?',
    },
  };

  get record(): DBAccount {
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
    }
    if (this.type === AccountType.VARIANT) {
      (ret as DBVariantAccount).pub = this.pub || '';
      (ret as DBVariantAccount).addresses = this.addresses || {};
    }
    if (this.type === AccountType.UTXO) {
      (ret as DBUTXOAccount).pub = this.pub || '';
      (ret as DBUTXOAccount).xpub = this.xpub || '';
      (ret as DBUTXOAccount).xpubSegwit = this.xpubSegwit || '';
      (ret as DBUTXOAccount).addresses = this.addresses || {};
      (ret as DBUTXOAccount).customAddresses = this.customAddresses || {};
    }
    return ret;
  }
}
export { RealmSchemaAccount };
