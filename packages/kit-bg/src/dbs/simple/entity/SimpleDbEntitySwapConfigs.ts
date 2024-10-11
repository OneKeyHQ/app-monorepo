import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  type ESwapProviderSort,
  maxRecentTokenPairs,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

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
  async addRecentTokenPair(
    fromToken: ISwapToken,
    toToken: ISwapToken,
    isExit: boolean,
  ) {
    const data = await this.getRawData();
    let recentTokenPairs = data?.recentTokenPairs ?? [];
    if (isExit) {
      recentTokenPairs = recentTokenPairs.filter(
        (pair) =>
          !(
            (equalTokenNoCaseSensitive({
              token1: fromToken,
              token2: pair.fromToken,
            }) &&
              equalTokenNoCaseSensitive({
                token1: toToken,
                token2: pair.toToken,
              })) ||
            (equalTokenNoCaseSensitive({
              token1: fromToken,
              token2: pair.toToken,
            }) &&
              equalTokenNoCaseSensitive({
                token1: toToken,
                token2: pair.fromToken,
              }))
          ),
      );
    }
    let newRecentTokenPairs = [
      {
        fromToken,
        toToken,
      },
      ...recentTokenPairs,
    ];

    let singleChainTokenPairs = newRecentTokenPairs.filter(
      (t) => t.fromToken.networkId === t.toToken.networkId,
    );
    let crossChainTokenPairs = newRecentTokenPairs.filter(
      (t) => t.fromToken.networkId !== t.toToken.networkId,
    );

    if (singleChainTokenPairs.length > maxRecentTokenPairs) {
      singleChainTokenPairs = singleChainTokenPairs.slice(
        0,
        maxRecentTokenPairs,
      );
    }
    if (crossChainTokenPairs.length > maxRecentTokenPairs) {
      crossChainTokenPairs = crossChainTokenPairs.slice(0, maxRecentTokenPairs);
    }
    newRecentTokenPairs = [...singleChainTokenPairs, ...crossChainTokenPairs];

    await this.setRawData({
      ...data,
      recentTokenPairs: newRecentTokenPairs,
    });
  }
}
