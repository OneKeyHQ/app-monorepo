import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

import type { IDBWallet, IDBWalletType } from '../../types';
import type Realm from 'realm';

class RealmSchemaWallet extends RealmObjectBase<IDBWallet> {
  public id!: string;

  public name!: string;

  public avatar?: string;

  public type!: IDBWalletType;

  public backuped?: boolean;

  public accounts?: string[];

  public walletNo!: number;

  public nextIds?: Realm.Dictionary<number>;

  public associatedDevice?: string;

  public isTemp?: boolean;

  public passphraseState?: string;

  public xfp?: string;

  public airGapAccountsInfoRaw?: string;

  public static override schema: Realm.ObjectSchema = {
    name: ELocalDBStoreNames.Wallet,
    primaryKey: 'id',
    properties: {
      id: 'string',
      name: 'string',
      avatar: 'string?',
      type: 'string',
      backuped: { type: 'bool', default: false },
      accounts: 'string?[]',
      walletNo: 'int',
      nextIds: {
        type: 'dictionary',
        default: {},
        objectType: 'int',
      },
      associatedDevice: 'string?',
      isTemp: { type: 'bool', default: false },
      passphraseState: 'string?',
      xfp: 'string?',
      airGapAccountsInfoRaw: 'string?',
    },
  };

  get record(): IDBWallet {
    return {
      id: this.id,
      name: this.name,
      avatar: this.avatar,
      type: this.type,
      backuped: this.backuped || false,
      // convert RealmDB list to array
      accounts: Array.from(this.accounts || []),
      walletNo: this.walletNo,
      nextIds: Object.fromEntries(Object.entries(Object(this.nextIds))),
      associatedDevice: this.associatedDevice,
      isTemp: this.isTemp,
      passphraseState: this.passphraseState,
      xfp: this.xfp,
      airGapAccountsInfoRaw: this.airGapAccountsInfoRaw,
    };
  }
}

export { RealmSchemaWallet };
