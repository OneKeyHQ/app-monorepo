import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

import type { RealmSchemaAccount } from './RealmSchemaAccount';
import type { RealmSchemaDevice } from './RealmSchemaDevice';
import type { DBWallet, IDBAvatar, IDBWalletType } from '../../types';
import type Realm from 'realm';

class RealmSchemaWallet extends RealmObjectBase<DBWallet> {
  public id!: string;

  public name!: string;

  public avatar?: string; // Use a string to store the stringified JSON object

  public type!: IDBWalletType;

  public backuped?: boolean;

  public accounts?: Realm.Set<RealmSchemaAccount>;

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

  get record(): DBWallet {
    let avatar: IDBAvatar | undefined;
    const parsedAvatar = JSON.parse(this.avatar || '{}');
    if (Object.keys(parsedAvatar).length > 0) {
      avatar = parsedAvatar;
    }
    return {
      id: this.id,
      name: this.name,
      avatar,
      type: this.type,
      backuped: this.backuped || false,
      accounts: (this.accounts || []).map((account) => account.id),
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
