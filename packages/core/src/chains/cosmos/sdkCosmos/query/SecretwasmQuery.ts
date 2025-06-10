import type {
import { OneKeyPlainTextError } from '@onekeyhq/shared/src/errors';
  ICosmosCw20AssetInfo,
  ICosmosCw20TokenBalance,
  IQuery,
} from './IQuery';

export class SecretwasmQuery implements IQuery {
  public queryCw20TokenInfo(): Promise<ICosmosCw20AssetInfo[]> {
    throw new OneKeyPlainTextError('Not implemented');
  }

  public queryCw20TokenBalance(): Promise<ICosmosCw20TokenBalance[]> {
    throw new OneKeyPlainTextError('Not implemented');
  }
}
