import Realm from 'realm';

class NetworkSchema extends Realm.Object {
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

  public static schema: Realm.ObjectSchema = {
    name: 'Network',
    primaryKey: 'id',
    properties: {
      id: 'string',
      name: { type: 'string', indexed: true },
      impl: 'string',
      symbol: 'string',
      logoURI: 'string?',
      enabled: { type: 'bool', default: false },
      preset: { type: 'bool', default: false },
      feeSymbol: 'string',
      decimals: 'int',
      feeDecimals: 'int',
      balance2FeeDecimals: 'int',
      rpcURL: 'string',
      position: 'int',
    },
  };
}

export { NetworkSchema };
