import Realm from 'realm';

import type { Token } from '../../../types/token';

class TokenSchema extends Realm.Object {
  public id!: string;

  public name!: string;

  public networkId!: string;

  public tokenIdOnNetwork!: string;

  public symbol!: string;

  public logoURI?: string;

  public decimals!: number;

  public static schema: Realm.ObjectSchema = {
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

  get internalObj(): Token {
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
export { TokenSchema };
