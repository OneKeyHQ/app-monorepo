import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  ESwapProviderSort,
  ISwapProviderManager,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { maxRecentTokenPairs } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IPopularTrading,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ISwapConfigs {
  providerSort?: ESwapProviderSort;
  recentTokenPairs?: { fromToken: ISwapToken; toToken: ISwapToken }[];
  swapProviderManager?: ISwapProviderManager[];
  bridgeProviderManager?: ISwapProviderManager[];
  swapUserCloseTips?: string[];
  popularTrading?: IPopularTrading[];
}

export class SimpleDbEntitySwapConfigs extends SimpleDbEntityBase<ISwapConfigs> {
  entityName = 'swapConfigs';

  override enableCache = false;

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

  @backgroundMethod()
  async getSwapProviderManager() {
    const data = await this.getRawData();
    return data?.swapProviderManager ?? [];
  }

  @backgroundMethod()
  async getBridgeProviderManager() {
    const data = await this.getRawData();
    return data?.bridgeProviderManager ?? [];
  }

  @backgroundMethod()
  async setSwapProviderManager(providerManager: ISwapProviderManager[]) {
    const data = await this.getRawData();
    await this.setRawData({
      ...data,
      swapProviderManager: providerManager,
    });
  }

  @backgroundMethod()
  async setBridgeProviderManager(providerManager: ISwapProviderManager[]) {
    const data = await this.getRawData();
    await this.setRawData({
      ...data,
      bridgeProviderManager: providerManager,
    });
  }

  @backgroundMethod()
  async getSwapUserCloseTips() {
    const data = await this.getRawData();
    return data?.swapUserCloseTips ?? [];
  }

  @backgroundMethod()
  async setSwapUserCloseTips(tipsId: string) {
    const data = await this.getRawData();
    await this.setRawData({
      ...data,
      swapUserCloseTips: [...(data?.swapUserCloseTips ?? []), tipsId],
    });
  }

  @backgroundMethod()
  async updatePopularTrading(popularTrading: IPopularTrading[]) {
    const data = await this.getRawData();
    await this.setRawData({
      ...data,
      popularTrading,
    });
  }

  @backgroundMethod()
  async getPopularTrading() {
    const data = await this.getRawData();
    return data?.popularTrading ?? [];
  }
}
