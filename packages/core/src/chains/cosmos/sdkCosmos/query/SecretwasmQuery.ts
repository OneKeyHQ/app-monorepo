/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  Cw20AssetInfo,
  Cw20TokenBalance,
  IQuery,
  QueryChainInfo,
} from './IQuery';

export class SecretwasmQuery implements IQuery {
  public queryCw20TokenInfo(
    chainInfo: QueryChainInfo,
    contractAddressArray: string[],
  ): Promise<Cw20AssetInfo[]> {
    throw new Error('Not implemented');
  }

  public queryCw20TokenBalance(
    chainInfo: QueryChainInfo,
    contractAddress: string,
    address: string[],
  ): Promise<Cw20TokenBalance[]> {
    throw new Error('Not implemented');
  }
}
