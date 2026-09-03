import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import {
  mevSwapNetworks,
  swapDefaultSetTokens,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISpeedSwapConfig } from '@onekeyhq/shared/types/swap/types';

import type { IToken } from '../types';

function buildSwapPairFallbackConfig(networkId: string): ISpeedSwapConfig {
  const defaultTokenSet = swapDefaultSetTokens[networkId];
  const defaultTokens = [
    defaultTokenSet?.fromToken,
    defaultTokenSet?.toToken,
  ].flatMap((token) =>
    token
      ? [
          {
            ...token,
            speedSwapDefaultAmount: [],
          },
        ]
      : [],
  );
  return {
    provider: '',
    speedConfig: {
      spenderAddress: '',
      slippage: 0.5,
      defaultTokens,
      defaultLimitTokens: [],
      swapMevNetConfig: mevSwapNetworks,
    },
    supportSpeedSwap: false,
    onlySupportCrossChain: false,
    onlySupportSingleChain: false,
    speedDefaultSelectToken:
      defaultTokenSet?.toToken ?? defaultTokenSet?.fromToken,
    unavailable: true,
  };
}

function applySwapPairFallback({
  config,
  fallbackConfig,
}: {
  config: ISpeedSwapConfig;
  fallbackConfig: ISpeedSwapConfig;
}): ISpeedSwapConfig {
  const shouldUseDefaultTokensFallback =
    config.speedConfig.defaultTokens.length === 0;
  if (
    !shouldUseDefaultTokensFallback &&
    config.supportSpeedSwap !== undefined
  ) {
    return config;
  }
  return {
    ...config,
    speedConfig: {
      ...config.speedConfig,
      defaultTokens: shouldUseDefaultTokensFallback
        ? fallbackConfig.speedConfig.defaultTokens
        : config.speedConfig.defaultTokens,
    },
    supportSpeedSwap:
      config.supportSpeedSwap ?? fallbackConfig.supportSpeedSwap,
    speedDefaultSelectToken: shouldUseDefaultTokensFallback
      ? fallbackConfig.speedDefaultSelectToken
      : config.speedDefaultSelectToken,
  };
}

type ISpeedSwapConfigState = {
  config: ISpeedSwapConfig;
  scope?: string;
  fromCache?: boolean;
};

export function useSpeedSwapInit(
  networkId: string,
  enableNoNetworkCheck?: boolean,
) {
  const fallbackConfig = useMemo(
    () => buildSwapPairFallbackConfig(networkId),
    [networkId],
  );
  const speedSwapConfigScope = networkId;
  const swrKey = speedSwapConfigScope
    ? swrKeys.swapStockSpeedConfig({ networkId: speedSwapConfigScope })
    : undefined;
  const { result: speedSwapConfigState, isLoading: speedSwapConfigLoading } =
    usePromiseResult<ISpeedSwapConfigState>(
      async () => {
        if (enableNoNetworkCheck && !networkId) {
          return {
            config: fallbackConfig,
            scope: speedSwapConfigScope,
          };
        }
        const config = await backgroundApiProxy.serviceSwap
          .fetchSpeedSwapConfig({ networkId })
          .catch(() => undefined);
        if (config && !config.unavailable) {
          return {
            config: applySwapPairFallback({ config, fallbackConfig }),
            scope: speedSwapConfigScope,
          };
        }
        const cachedConfig = swrKey
          ? swrCacheUtils.get<ISpeedSwapConfigState>(swrKey)
          : undefined;
        return {
          config: applySwapPairFallback({
            config:
              cachedConfig?.scope === speedSwapConfigScope
                ? cachedConfig.config
                : (config ?? fallbackConfig),
            fallbackConfig,
          }),
          scope: speedSwapConfigScope,
          fromCache: true,
        };
      },
      [
        enableNoNetworkCheck,
        fallbackConfig,
        networkId,
        speedSwapConfigScope,
        swrKey,
      ],
      {
        initResult: {
          config: fallbackConfig,
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
    : fallbackConfig;

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
