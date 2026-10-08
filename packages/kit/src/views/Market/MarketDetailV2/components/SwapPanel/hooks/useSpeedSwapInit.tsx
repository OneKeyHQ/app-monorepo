import { useMemo } from 'react';

// cspell:ignore robinhood

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  mevSwapNetworks,
  swapDefaultSetTokens,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISpeedSwapConfig,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';

import type { IToken } from '../types';

const ROBINHOOD_NETWORK_ID = 'evm--4663';

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
  const safeConfig =
    config?.speedConfig && Array.isArray(config.speedConfig.defaultTokens)
      ? config
      : fallbackConfig;
  const shouldUseDefaultTokensFallback =
    safeConfig.speedConfig.defaultTokens.length === 0;
  const canonicalDefaultTokens = fallbackConfig.speedConfig.defaultTokens;
  const canonicalRobinhoodEthToken = canonicalDefaultTokens.find(
    (token) =>
      token.networkId === ROBINHOOD_NETWORK_ID &&
      token.isNative &&
      token.symbol === 'ETH',
  );
  const applyRobinhoodEthLogoFallback = (
    token?: ISwapTokenBase,
  ): ISwapTokenBase | undefined => {
    if (
      !token ||
      !canonicalRobinhoodEthToken?.logoURI ||
      canonicalRobinhoodEthToken.logoURI === token.logoURI ||
      !equalTokenNoCaseSensitive({
        token1: canonicalRobinhoodEthToken,
        token2: token,
      })
    ) {
      return undefined;
    }
    return {
      ...token,
      logoURI: canonicalRobinhoodEthToken.logoURI,
    };
  };
  const normalizedDefaultTokens = shouldUseDefaultTokensFallback
    ? canonicalDefaultTokens
    : safeConfig.speedConfig.defaultTokens.map(
        (token) => applyRobinhoodEthLogoFallback(token) ?? token,
      );
  const normalizedSpeedDefaultSelectToken = shouldUseDefaultTokensFallback
    ? fallbackConfig.speedDefaultSelectToken
    : (applyRobinhoodEthLogoFallback(safeConfig.speedDefaultSelectToken) ??
      safeConfig.speedDefaultSelectToken);
  const hasNormalizedTokenLogo =
    normalizedDefaultTokens.some(
      (token, index) => token !== safeConfig.speedConfig.defaultTokens[index],
    ) ||
    normalizedSpeedDefaultSelectToken !== safeConfig.speedDefaultSelectToken;
  if (
    !shouldUseDefaultTokensFallback &&
    safeConfig.supportSpeedSwap !== undefined &&
    !hasNormalizedTokenLogo
  ) {
    return safeConfig;
  }
  return {
    ...safeConfig,
    speedConfig: {
      ...safeConfig.speedConfig,
      defaultTokens: normalizedDefaultTokens,
    },
    supportSpeedSwap:
      safeConfig.supportSpeedSwap ?? fallbackConfig.supportSpeedSwap,
    speedDefaultSelectToken: normalizedSpeedDefaultSelectToken,
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
    speedSwapConfigState?.scope === speedSwapConfigScope;
  const rawSpeedSwapConfig = speedSwapConfigReady
    ? (speedSwapConfigState?.config ?? fallbackConfig)
    : fallbackConfig;
  const speedSwapConfig = useMemo(
    () =>
      applySwapPairFallback({
        config: rawSpeedSwapConfig,
        fallbackConfig,
      }),
    [fallbackConfig, rawSpeedSwapConfig],
  );

  return {
    speedSwapConfig,
    defaultTokens: (speedSwapConfig?.speedConfig?.defaultTokens ??
      []) as IToken[],
    defaultLimitTokens: (speedSwapConfig?.speedConfig?.defaultLimitTokens ??
      []) as IToken[],
    isLoading: !!speedSwapConfigLoading,
    speedConfigReady: speedSwapConfigReady,
    speedConfig: speedSwapConfig?.speedConfig,
    supportSpeedSwap: speedSwapConfig?.supportSpeedSwap,
    onlySupportCrossChain: speedSwapConfig?.onlySupportCrossChain,
    swapMevNetConfig: speedSwapConfig?.speedConfig.swapMevNetConfig,
    speedDefaultSelectToken: speedSwapConfig?.speedDefaultSelectToken,
  };
}
