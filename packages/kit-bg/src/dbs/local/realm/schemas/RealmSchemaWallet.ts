import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

import type { RealmSchemaAccount } from './RealmSchemaAccount';
import type { RealmSchemaDevice } from './RealmSchemaDevice';
import type { IDBWallet, IDBWalletType } from '../../types';
import type Realm from 'realm';

class RealmSchemaWallet extends RealmObjectBase<IDBWallet> {
  public id!: string;

  public name!: string;

  public avatar?: string;

  public type!: IDBWalletType;

  public backuped?: boolean;

  public accounts?: Realm.Set<RealmSchemaAccount>;

  public nextIndex!: number;

  public nextAccountIds?: Realm.Dictionary<number>;

  public associatedDevice?: RealmSchemaDevice;

  public deviceType?: string;

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
      accounts: { type: 'set', objectType: 'Account', default: [] },
      nextIndex: { type: 'int', default: 0 },
      nextAccountIds: {
        type: 'dictionary',
        default: {},
        objectType: 'int',
      },
      associatedDevice: 'Device?',
      deviceType: 'string?',
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
      accounts: (this.accounts || []).map((account) => account.id),
      nextIndex: this.nextIndex,
      nextAccountIds: Object.fromEntries(
        Object.entries(Object(this.nextAccountIds)),
      ),
      associatedDevice: this.associatedDevice?.id,
      deviceType: this.deviceType,
      passphraseState: this.passphraseState,
    };
  }
}

export { RealmSchemaWallet };
