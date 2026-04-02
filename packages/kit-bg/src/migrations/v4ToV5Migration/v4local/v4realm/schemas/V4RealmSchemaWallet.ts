import { EV4LocalDBStoreNames } from '../../v4localDBStoreNames';
import { V4RealmObjectBase } from '../base/V4RealmObjectBase';

import type { V4RealmSchemaAccount } from './V4RealmSchemaAccount';
import type { V4RealmSchemaDevice } from './V4RealmSchemaDevice';
import type { IV4DBWallet, IV4DBWalletType } from '../../v4localDBTypes';
import type Realm from 'realm';

class V4RealmSchemaWallet extends V4RealmObjectBase<IV4DBWallet> {
  public id!: string;

  public name!: string;

  public avatar?: string;

  public type!: IV4DBWalletType;

  public backuped?: boolean;

  public accounts?: Realm.Set<V4RealmSchemaAccount>;
  // public accounts?: string[];

  public nextAccountIds?: Realm.Dictionary<number>;

  public associatedDevice?: V4RealmSchemaDevice;
  // public associatedDevice?: string;

  public deviceType?: string;

  public passphraseState?: string;

  public static override schema: Realm.ObjectSchema = {
    name: EV4LocalDBStoreNames.Wallet,
    primaryKey: 'id',
    properties: {
      id: 'string',
      name: 'string',
      avatar: 'string?',
      type: 'string',
      backuped: { type: 'bool', default: false },
      accounts: {
        // type: 'Account<>',
        type: 'set',
        objectType: 'Account',
        default: [],
      },
      // accounts: 'string?[]',
      nextAccountIds: {
        type: 'dictionary',
        default: {},
        objectType: 'int',
      },
      associatedDevice: 'Device?',
      // associatedDevice: 'string?',
      deviceType: 'string?',
      passphraseState: 'string?',
    },
  };

  get record(): IV4DBWallet {
    return {
      id: this.id,
      name: this.name,
      avatar: this.avatar,
      type: this.type,
      backuped: this.backuped || false,
      // convert RealmDB list to array
      accounts: (this.accounts || []).map((account) => account.id),
      nextAccountIds: (this.nextAccountIds?.toJSON() as any) || {},
      associatedDevice: this.associatedDevice?.id,
      deviceType: this.deviceType,
      passphraseState: this.passphraseState,
    };
  }
}

export { V4RealmSchemaWallet };
