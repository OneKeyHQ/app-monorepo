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

  public nextIndex!: number;

  public walletNo!: number;

  public nextAccountIds?: Realm.Dictionary<number>;

  public associatedDevice?: string;

  public deviceType?: string;

  public isTemp?: boolean;

  public passphraseState?: string;

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
      nextIndex: { type: 'int', default: 0 },
      walletNo: 'int',
      nextAccountIds: {
        type: 'dictionary',
        default: {},
        objectType: 'int',
      },
      associatedDevice: 'string?',
      deviceType: 'string?',
      isTemp: { type: 'bool', default: false },
      passphraseState: 'string?',
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
      nextIndex: this.nextIndex,
      walletNo: this.walletNo,
      nextAccountIds: Object.fromEntries(
        Object.entries(Object(this.nextAccountIds)),
      ),
      associatedDevice: this.associatedDevice,
      deviceType: this.deviceType,
      isTemp: this.isTemp,
      passphraseState: this.passphraseState,
    };
  }
}

export { RealmSchemaWallet };
