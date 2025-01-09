import type {
  ICosmosCw20AssetInfo,
  ICosmosCw20TokenBalance,
  IQuery,
} from './IQuery';

export class SecretwasmQuery implements IQuery {
  public queryCw20TokenInfo(): Promise<ICosmosCw20AssetInfo[]> {
    throw new Error('Not implemented');
  }

  public queryCw20TokenBalance(): Promise<ICosmosCw20TokenBalance[]> {
    throw new Error('Not implemented');
  }
}
