import { EV4LocalDBStoreNames } from '../../v4localDBStoreNames';
import { V4RealmObjectBase } from '../base/V4RealmObjectBase';

import type { IV4DBNetwork } from '../../v4localDBTypes';
import type Realm from 'realm';

class V4RealmSchemaNetwork extends V4RealmObjectBase<IV4DBNetwork> {
  public id!: string;

  public name!: string;

  public symbol!: string;

  public logoURI!: string;

  public enabled!: boolean;

  public preset!: boolean;

  public impl!: string;

  public feeSymbol!: string;

  public decimals!: number;

  public feeDecimals!: number;

  public balance2FeeDecimals!: number;

  public position!: number;

  public rpcURL!: string;

  public curve?: string;

  public explorerURL?: string;

  public static override schema: Realm.ObjectSchema = {
    name: EV4LocalDBStoreNames.Network,
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

  get record(): IV4DBNetwork {
    const ret = {
      id: this.id,
      name: this.name,
      impl: this.impl,
      symbol: this.symbol,
      logoURI: this.logoURI,
      enabled: this.enabled,
      feeSymbol: this.feeSymbol,
      decimals: this.decimals,
      feeDecimals: this.feeDecimals,
      balance2FeeDecimals: this.balance2FeeDecimals,
      rpcURL: this.rpcURL,
      position: this.position,
    };
    if (this.curve !== null) {
      Object.assign(ret, { curve: this.curve });
    }
    if (this.explorerURL !== null) {
      Object.assign(ret, { explorerURL: this.explorerURL });
    }
    return ret;
  }
}

export { V4RealmSchemaNetwork };
