import type { Cw20AssetInfo, Cw20TokenBalance, IQuery } from './IQuery';

export class SecretwasmQuery implements IQuery {
  public queryCw20TokenInfo(): Promise<Cw20AssetInfo[]> {
    throw new Error('Not implemented');
  }

  public queryCw20TokenBalance(): Promise<Cw20TokenBalance[]> {
    throw new Error('Not implemented');
  }
}
