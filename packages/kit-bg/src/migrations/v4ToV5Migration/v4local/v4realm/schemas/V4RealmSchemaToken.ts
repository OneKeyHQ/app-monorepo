import { V4RealmObjectBase } from '../base/V4RealmObjectBase';

import type { IV4DBToken } from '../../v4localDBTypes';
import type Realm from 'realm';

export class V4RealmSchemaToken extends V4RealmObjectBase<IV4DBToken> {
  public id!: string;

  public name!: string;

  public networkId!: string;

  public tokenIdOnNetwork!: string;

  public symbol!: string;

  public logoURI?: string;

  public decimals!: number;

  public static override schema: Realm.ObjectSchema = {
    name: 'Token',
    primaryKey: 'id',
    properties: {
      id: 'string',
      name: { type: 'string', indexed: true },
      networkId: 'string',
      tokenIdOnNetwork: 'string',
      symbol: 'string',
      decimals: 'int',
      logoURI: 'string?',
    },
  };

  get record(): IV4DBToken {
    return {
      id: this.id,
      name: this.name,
      networkId: this.networkId,
      tokenIdOnNetwork: this.tokenIdOnNetwork,
      symbol: this.symbol,
      decimals: this.decimals,
      logoURI: this.logoURI || '',
    };
  }
}
