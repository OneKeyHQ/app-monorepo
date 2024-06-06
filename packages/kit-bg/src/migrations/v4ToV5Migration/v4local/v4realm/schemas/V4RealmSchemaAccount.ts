import { EV4DBAccountType } from '../../../v4types';
import { EV4LocalDBStoreNames } from '../../v4localDBStoreNames';
import { V4RealmObjectBase } from '../base/V4RealmObjectBase';

import type { V4RealmSchemaToken } from './V4RealmSchemaToken';
import type { V4RealmSchemaWallet } from './V4RealmSchemaWallet';
import type {
  IV4DBAccount,
  // IV4DBExternalAccount,
  IV4DBSimpleAccount,
  IV4DBUtxoAccount,
  IV4DBVariantAccount,
} from '../../v4localDBTypes';
import type Realm from 'realm';

class V4RealmSchemaAccount extends V4RealmObjectBase<IV4DBAccount> {
  public id!: string;

  public name!: string;

  public type!: EV4DBAccountType;

  public path?: string;

  public coinType!: string;

  public pub?: string;

  public xpub?: string;

  public xpubSegwit?: string;

  public address?: string;

  public addresses?: Realm.Dictionary<string>;

  public customAddresses?: Realm.Dictionary<string>;

  public tokens?: Realm.Set<V4RealmSchemaToken>;

  public assignee!: Realm.Results<V4RealmSchemaWallet>;

  public template?: string;

  public static override schema: Realm.ObjectSchema = {
    name: EV4LocalDBStoreNames.Account,
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
      tokens: {
        // type: 'Token<>',
        type: 'set',
        objectType: 'Token',
        default: [],
      },
      assignee: {
        type: 'linkingObjects',
        objectType: 'Wallet',
        property: 'accounts',
      },
      template: 'string?',
    },
  };

  get record(): IV4DBAccount {
    const ret: IV4DBAccount = {
      id: this.id,
      name: this.name,
      type: this.type,
      path: this.path || '',
      coinType: this.coinType,
      address: this.address || '',
      template: this.template || '',
      pub: '',
      addresses: {},
    };
    if (this.type === EV4DBAccountType.SIMPLE) {
      (ret as IV4DBSimpleAccount).pub = this.pub || '';
    } else if (this.type === EV4DBAccountType.VARIANT) {
      (ret as IV4DBVariantAccount).pub = this.pub || '';
      (ret as IV4DBVariantAccount).addresses = this.addresses || {};
    } else if (this.type === EV4DBAccountType.UTXO) {
      (ret as IV4DBUtxoAccount).pub = this.pub || '';
      (ret as IV4DBUtxoAccount).xpub = this.xpub || '';
      (ret as IV4DBUtxoAccount).xpubSegwit = this.xpubSegwit || '';
      (ret as IV4DBUtxoAccount).addresses = this.addresses || {};
      (ret as IV4DBUtxoAccount).customAddresses = this.customAddresses || {};
    }
    return ret;
  }
}
export { V4RealmSchemaAccount };
