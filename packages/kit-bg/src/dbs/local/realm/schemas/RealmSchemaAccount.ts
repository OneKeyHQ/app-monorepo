import { EDBAccountType } from '../../consts';
import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

import type { RealmSchemaWallet } from './RealmSchemaWallet';
import type {
  IDBAccount,
  IDBUtxoAccount,
  IDBVariantAccount,
} from '../../types';
import type Realm from 'realm';

class RealmSchemaAccount extends RealmObjectBase<IDBAccount> {
  public id!: string;

  public name!: string;

  public type!: EDBAccountType;

  public path?: string;

  public coinType!: string;

  public impl!: string;

  public networks?: string[];

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
      impl: 'string',
      networks: 'string?[]',
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

  get record(): IDBAccount {
    const ret: IDBAccount = {
      id: this.id,
      name: this.name,
      type: this.type,
      path: this.path || '',
      coinType: this.coinType,
      address: this.address || '',
      template: this.template || '',
      pub: '',
      impl: this.impl,
      networks: this.networks,
    };
    if (this.type === EDBAccountType.SIMPLE) {
      ret.pub = this.pub || '';
    }
    if (this.type === EDBAccountType.VARIANT) {
      (ret as IDBVariantAccount).pub = this.pub || '';
      (ret as IDBVariantAccount).addresses = this.addresses || {};
    }
    if (this.type === EDBAccountType.UTXO) {
      (ret as IDBUtxoAccount).pub = this.pub || '';
      (ret as IDBUtxoAccount).xpub = this.xpub || '';
      (ret as IDBUtxoAccount).xpubSegwit = this.xpubSegwit || '';
      (ret as IDBUtxoAccount).addresses = this.addresses || {};
      (ret as IDBUtxoAccount).customAddresses = this.customAddresses || {};
    }
    return ret;
  }
}
export { RealmSchemaAccount };
