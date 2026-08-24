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
  shouldPersist: boolean;
};

export function useSpeedSwapInit(
  networkId: string,
  enableNoNetworkCheck?: boolean,
) {
  const speedSwapConfigScope = networkId;
  const { result: speedSwapConfigState, isLoading: speedSwapConfigLoading } =
    usePromiseResult<ISpeedSwapConfigState>(
      async () => {
        if (enableNoNetworkCheck && !networkId) {
          return {
            config: defaultSpeedSwapConfig,
            scope: speedSwapConfigScope,
            shouldPersist: true,
          };
        }
        try {
          const config =
            await backgroundApiProxy.serviceSwap.fetchSpeedSwapConfig({
              networkId,
            });
          return {
            config,
            scope: speedSwapConfigScope,
            shouldPersist: true,
          };
        } catch {
          const cachedConfig = speedSwapConfigScope
            ? swrCacheUtils.get<{
                config: ISpeedSwapConfig;
                scope: string;
              }>(
                swrKeys.swapStockSpeedConfig({
                  networkId: speedSwapConfigScope,
                }),
              )
            : undefined;
          return {
            config:
              cachedConfig?.scope === speedSwapConfigScope
                ? cachedConfig.config
                : defaultSpeedSwapConfig,
            scope: speedSwapConfigScope,
            shouldPersist: false,
          };
        }
      },
      [enableNoNetworkCheck, networkId, speedSwapConfigScope],
      {
        initResult: {
          config: defaultSpeedSwapConfig,
          scope: undefined,
          shouldPersist: true,
        },
        watchLoading: true,
        swrKey: speedSwapConfigScope
          ? swrKeys.swapStockSpeedConfig({ networkId: speedSwapConfigScope })
          : undefined,
        swrShouldPersist: (result) => result.shouldPersist !== false,
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
