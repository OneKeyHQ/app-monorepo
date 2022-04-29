import { AccountSchema, DeviceSchema } from '.';

import Realm from 'realm';

import { Avatar } from '@onekeyhq/kit/src/utils/emojiUtils';

import { Wallet, WalletType } from '../../../types/wallet';

class WalletSchema extends Realm.Object {
  public id!: string;

  public name!: string;

  public avatar?: string; // Use a string to store the stringified JSON object

  public type!: WalletType;

  public backuped?: boolean;

  public accounts?: Realm.Set<AccountSchema>;

  public nextAccountIds?: Realm.Dictionary<number>;

  public associatedDevice?: DeviceSchema;

  public static schema: Realm.ObjectSchema = {
    name: 'Wallet',
    primaryKey: 'id',
    properties: {
      id: 'string',
      name: 'string',
      avatar: 'string?',
      type: 'string',
      backuped: { type: 'bool', default: false },
      accounts: { type: 'Account<>', default: [] },
      nextAccountIds: {
        type: 'dictionary',
        default: {},
        objectType: 'int',
      },
      associatedDevice: 'Device?',
    },
  };

  get internalObj(): Wallet {
    let avatar: Avatar | undefined;
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
    };
  }
}

export { WalletSchema };
