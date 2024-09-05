import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { ESwapProviderSort } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

const maxRecentTokenPairs = 10;
export interface ISwapConfigs {
  providerSort?: ESwapProviderSort;
  recentTokenPairs?: { fromToken: ISwapToken; toToken: ISwapToken }[];
}

export class SimpleDbEntitySwapConfigs extends SimpleDbEntityBase<ISwapConfigs> {
  entityName = 'swapConfigs';

  @backgroundMethod()
  async getRecentTokenPairs() {
    const data = await this.getRawData();
    return data?.recentTokenPairs ?? [];
  }

  @backgroundMethod()
  async addRecentTokenPair(fromToken: ISwapToken, toToken: ISwapToken) {
    const data = await this.getRawData();
    let recentTokenPairs = data?.recentTokenPairs ?? [];
    if (
      recentTokenPairs.find(
        (pair) =>
          pair.fromToken.contractAddress === fromToken.contractAddress &&
          pair.toToken.contractAddress === toToken.contractAddress,
      )
    ) {
      recentTokenPairs = recentTokenPairs.filter(
        (pair) =>
          pair.fromToken.contractAddress !== fromToken.contractAddress &&
          pair.toToken.contractAddress !== toToken.contractAddress,
      );
    }
    recentTokenPairs.unshift({ fromToken, toToken });
    if (recentTokenPairs.length > maxRecentTokenPairs) {
      recentTokenPairs = recentTokenPairs.slice(0, maxRecentTokenPairs);
    }
    await this.setRawData({
      ...data,
      recentTokenPairs,
    });
  }
}
