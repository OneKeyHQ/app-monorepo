import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  ICosmosCw20AssetInfo,
  ICosmosCw20TokenBalance,
  IQuery,
} from './IQuery';

export class SecretwasmQuery implements IQuery {
  public queryCw20TokenInfo(): Promise<ICosmosCw20AssetInfo[]> {
    throw new OneKeyLocalError('Not implemented');
  }

  public queryCw20TokenBalance(): Promise<ICosmosCw20TokenBalance[]> {
    throw new OneKeyLocalError('Not implemented');
  }
}
