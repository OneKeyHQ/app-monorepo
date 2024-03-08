import { EDBAccountType } from '../../consts';
import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

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

  public pathIndex?: number;

  public relPath?: string;

  public indexedAccountId?: string;

  public coinType!: string;

  public impl!: string;

  public networks?: string[];

  public createAtNetwork?: string;

  public pub?: string;

  public xpub?: string;

  public xpubSegwit?: string;

  public address?: string;

  public addresses?: Realm.Dictionary<string>;

  public customAddresses?: Realm.Dictionary<string>;

  public template?: string;

  public static override schema: Realm.ObjectSchema = {
    name: ELocalDBStoreNames.Account,
    primaryKey: 'id',
    properties: {
      id: 'string',
      name: 'string',
      type: 'string',
      path: 'string?',
      pathIndex: 'int?',
      relPath: 'string?',
      indexedAccountId: 'string?',
      coinType: 'string',
      impl: 'string',
      networks: 'string?[]',
      createAtNetwork: 'string?',
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
      template: 'string?',
    },
  };

  get record(): IDBAccount {
    const ret: IDBAccount = {
      id: this.id,
      name: this.name,
      type: this.type,
      path: this.path || '',
      pathIndex: this.pathIndex,
      relPath: this.relPath,
      indexedAccountId: this.indexedAccountId,
      coinType: this.coinType,
      address: this.address || '',
      template: this.template || '',
      pub: '',
      impl: this.impl,
      networks: Array.from(this.networks || []),
      createAtNetwork: this.createAtNetwork,
    };
    if (this.type === EDBAccountType.SIMPLE) {
      ret.pub = this.pub || '';
    }
    if (this.type === EDBAccountType.VARIANT) {
      (ret as IDBVariantAccount).pub = this.pub || '';
      (ret as IDBVariantAccount).addresses =
        (this.addresses?.toJSON() as any) || {};
    }
    if (this.type === EDBAccountType.UTXO) {
      (ret as IDBUtxoAccount).pub = this.pub || '';
      (ret as IDBUtxoAccount).xpub = this.xpub || '';
      (ret as IDBUtxoAccount).xpubSegwit = this.xpubSegwit || '';
      (ret as IDBUtxoAccount).addresses =
        (this.addresses?.toJSON() as any) || {};
      (ret as IDBUtxoAccount).customAddresses =
        (this.customAddresses?.toJSON() as any) || {};
    }
    return ret;
  }
}
export { RealmSchemaAccount };
