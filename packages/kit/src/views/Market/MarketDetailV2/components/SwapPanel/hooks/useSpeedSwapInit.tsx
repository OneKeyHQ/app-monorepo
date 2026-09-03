import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import { mevSwapNetworks } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISpeedSwapConfig } from '@onekeyhq/shared/types/swap/types';

import type { IToken } from '../types';

const defaultSpeedSwapConfig: ISpeedSwapConfig = {
  provider: '',
  speedConfig: {
    spenderAddress: '',
    slippage: 0.5,
    defaultTokens: [],
    defaultLimitTokens: [],
    swapMevNetConfig: mevSwapNetworks,
  },
  supportSpeedSwap: undefined,
  onlySupportCrossChain: false,
  onlySupportSingleChain: false,
  speedDefaultSelectToken: undefined,
};

type ISpeedSwapConfigState = {
  config: ISpeedSwapConfig;
  scope?: string;
  fromCache?: boolean;
};

export function useSpeedSwapInit(
  networkId: string,
  enableNoNetworkCheck?: boolean,
) {
  const speedSwapConfigScope = networkId;
  const swrKey = speedSwapConfigScope
    ? swrKeys.swapStockSpeedConfig({ networkId: speedSwapConfigScope })
    : undefined;
  const { result: speedSwapConfigState, isLoading: speedSwapConfigLoading } =
    usePromiseResult<ISpeedSwapConfigState>(
      async () => {
        if (enableNoNetworkCheck && !networkId) {
          return {
            config: defaultSpeedSwapConfig,
            scope: speedSwapConfigScope,
          };
        }
        const config = await backgroundApiProxy.serviceSwap
          .fetchSpeedSwapConfig({ networkId })
          .catch(() => undefined);
        if (config && !config.unavailable) {
          return {
            config,
            scope: speedSwapConfigScope,
          };
        }
        const cachedConfig = swrKey
          ? swrCacheUtils.get<ISpeedSwapConfigState>(swrKey)
          : undefined;
        return {
          config:
            cachedConfig?.scope === speedSwapConfigScope
              ? cachedConfig.config
              : defaultSpeedSwapConfig,
          scope: speedSwapConfigScope,
          fromCache: true,
        };
      },
      [enableNoNetworkCheck, networkId, speedSwapConfigScope, swrKey],
      {
        initResult: {
          config: defaultSpeedSwapConfig,
          scope: undefined,
        },
        watchLoading: true,
        swrKey,
        swrShouldPersist: (result) => !result.fromCache,
      },
    );
  const speedSwapConfigReady =
    speedSwapConfigState.scope === speedSwapConfigScope;
  const speedSwapConfig = speedSwapConfigReady
    ? speedSwapConfigState.config
    : defaultSpeedSwapConfig;

  return {
    defaultTokens: speedSwapConfig?.speedConfig.defaultTokens as IToken[],
    defaultLimitTokens: speedSwapConfig?.speedConfig
      .defaultLimitTokens as IToken[],
    isLoading: !!speedSwapConfigLoading,
    speedConfigReady: speedSwapConfigReady,
    speedConfig: speedSwapConfig?.speedConfig,
    supportSpeedSwap: speedSwapConfig?.supportSpeedSwap,
    onlySupportCrossChain: speedSwapConfig?.onlySupportCrossChain,
    swapMevNetConfig: speedSwapConfig?.speedConfig.swapMevNetConfig,
    speedDefaultSelectToken: speedSwapConfig?.speedDefaultSelectToken,
  };
}
