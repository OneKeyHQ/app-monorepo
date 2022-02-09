import Realm from 'realm';

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
}
export { TokenSchema };
